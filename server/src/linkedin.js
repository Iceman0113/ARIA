// LinkedIn integration — OAuth + posting via the official API.
// Endpoints used:
//   POST https://www.linkedin.com/oauth/v2/accessToken   (token exchange + refresh)
//   GET  https://api.linkedin.com/v2/userinfo            (OIDC userinfo, gets member URN)
//   POST https://api.linkedin.com/rest/posts             (create post)
//
// Tokens are stored per tenant in the linkedin_auth Supabase table.
// Access tokens last ~60 days, refresh tokens last ~365 days.

import { getSupabase, getTenantId } from './supabase.js';

const OAUTH_AUTH_URL    = 'https://www.linkedin.com/oauth/v2/authorization';
const OAUTH_TOKEN_URL   = 'https://www.linkedin.com/oauth/v2/accessToken';
const OIDC_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const POSTS_URL         = 'https://api.linkedin.com/rest/posts';

// LinkedIn API version header — yyyymm format. Bump when LinkedIn deprecates.
const API_VERSION = '202405';

// Scopes:
//   openid profile email     → OIDC userinfo (gets the member URN as `sub`)
//   w_member_social          → permission to post on the user's behalf (personal feed)
//
// Org scopes (r_organization_admin + w_organization_social) require LinkedIn's
// Community Management API product, which is a separate approval process and
// is NOT available via the standard developer app product list. Once approved,
// re-add them here and re-authorize. The code in this file (fetchAdminOrganizations,
// resolveAuthor) already handles them gracefully — they just no-op until granted.
const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

const REDIRECT_PATH = '/auth/linkedin/callback';

/** Build the LinkedIn authorize URL the user gets bounced to from `/auth/linkedin`. */
export function buildAuthorizeUrl(state, baseUrl) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID not set in .env');
  const redirectUri = (process.env.LINKEDIN_REDIRECT_URI || `${baseUrl}${REDIRECT_PATH}`);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

/** Exchange the authorization code from the callback for access + refresh tokens. */
export async function exchangeCodeForTokens(code, baseUrl) {
  const clientId     = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri  = process.env.LINKEDIN_REDIRECT_URI || `${baseUrl}${REDIRECT_PATH}`;
  if (!clientId || !clientSecret) throw new Error('LinkedIn client credentials missing');

  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    client_id:     clientId,
    client_secret: clientSecret,
    redirect_uri:  redirectUri,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Refresh an expired access token. Returns the new token bundle. */
export async function refreshAccessToken(refreshToken) {
  const clientId     = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('LinkedIn client credentials missing');

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn refresh failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Hit /userinfo to get the user's URN (the `sub` field — formatted as the LinkedIn member ID). */
export async function fetchMemberUrn(accessToken) {
  const res = await fetch(OIDC_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`/userinfo failed (${res.status}): ${text}`);
  }
  const info = await res.json();
  // `sub` is the member ID; the URN format is "urn:li:person:<sub>"
  return { urn: `urn:li:person:${info.sub}`, name: info.name, email: info.email };
}

/**
 * Look up Company Pages the user is an ADMINISTRATOR of. Requires
 * r_organization_admin scope. Returns [] for users who admin no Pages.
 *
 * Endpoint: GET /v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED
 * Then for each org URN, hit /v2/organizations/{id} for the localized name.
 */
export async function fetchAdminOrganizations(accessToken) {
  // Step 1: get the list of org URNs the user admins
  const aclUrl = 'https://api.linkedin.com/v2/organizationalEntityAcls'
    + '?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&projection=(elements*(organizationalTarget))';
  const aclRes = await fetch(aclUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
  });
  if (!aclRes.ok) {
    // 403 here usually means r_organization_admin wasn't granted, or user admins none
    return [];
  }
  const acls = await aclRes.json();
  const urns = (acls.elements || []).map((e) => e.organizationalTarget).filter(Boolean);
  if (urns.length === 0) return [];

  // Step 2: look up each org's display name
  const orgs = [];
  for (const urn of urns) {
    const orgId = urn.split(':').pop();
    try {
      const orgRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!orgRes.ok) { orgs.push({ urn, name: orgId, vanity: null }); continue; }
      const o = await orgRes.json();
      orgs.push({
        urn,
        name: o.localizedName || o.name?.localized?.en_US || o.vanityName || orgId,
        vanity: o.vanityName || null,
      });
    } catch {
      orgs.push({ urn, name: orgId, vanity: null });
    }
  }
  return orgs;
}

/** Persist tokens for the current tenant. Insert or update. */
export async function saveAuth({ accessToken, refreshToken, expiresInSec, refreshExpiresInSec, memberUrn, memberName, organizations }) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase not configured — LinkedIn auth needs persistent storage');
  const tenantId = await getTenantId();
  if (!tenantId) throw new Error('Tenant not found');

  const now = Date.now();
  const row = {
    tenant_id: tenantId,
    member_urn: memberUrn,
    access_token: accessToken,
    refresh_token: refreshToken ?? null,
    expires_at: new Date(now + expiresInSec * 1000).toISOString(),
    refresh_expires_at: refreshExpiresInSec ? new Date(now + refreshExpiresInSec * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  // Only set these if provided (refresh-token flow doesn't re-fetch them)
  if (memberName !== undefined)   row.member_name = memberName;
  if (organizations !== undefined) row.organizations = organizations;

  // Upsert by tenant_id (the PK)
  const { error } = await sb.from('linkedin_auth').upsert(row, { onConflict: 'tenant_id' });
  if (error) throw new Error(`Could not save LinkedIn auth: ${error.message}`);
  return row;
}

/** Read tokens for the current tenant. Returns null if not connected. */
export async function loadAuth() {
  const sb = getSupabase();
  if (!sb) return null;
  const tenantId = await getTenantId();
  if (!tenantId) return null;
  const { data, error } = await sb.from('linkedin_auth').select('*').eq('tenant_id', tenantId).maybeSingle();
  if (error || !data) return null;
  return data;
}

/** Return a valid access token + the full auth row, refreshing if it expires within 5 minutes. */
export async function getValidAccessToken() {
  const auth = await loadAuth();
  if (!auth) return null;
  const expiresAt = new Date(auth.expires_at).getTime();
  const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
  if (expiresAt > fiveMinFromNow) {
    return { accessToken: auth.access_token, memberUrn: auth.member_urn, organizations: auth.organizations || [] };
  }
  // Refresh
  if (!auth.refresh_token) throw new Error('LinkedIn token expired and no refresh token stored');
  const fresh = await refreshAccessToken(auth.refresh_token);
  await saveAuth({
    accessToken:        fresh.access_token,
    refreshToken:       fresh.refresh_token || auth.refresh_token,
    expiresInSec:       fresh.expires_in,
    refreshExpiresInSec: fresh.refresh_token_expires_in,
    memberUrn:          auth.member_urn,
  });
  return { accessToken: fresh.access_token, memberUrn: auth.member_urn, organizations: auth.organizations || [] };
}

/**
 * Resolve the requested author into a valid LinkedIn URN.
 * Accepts: 'person', 'organization', a vanity ('jack-jewell'), a name match,
 * or a fully-qualified URN. Returns { urn, label } or { error }.
 */
function resolveAuthor(requested, auth) {
  const orgs = auth.organizations || [];

  // Default: post as person
  if (!requested || requested === 'person' || requested === 'me' || requested === 'self') {
    return { urn: auth.memberUrn, label: 'You (personal feed)' };
  }
  // Explicit URN
  if (typeof requested === 'string' && requested.startsWith('urn:li:organization:')) {
    const org = orgs.find((o) => o.urn === requested);
    if (!org) return { error: `Not an admin of ${requested}. Available: ${orgs.map(o => o.name).join(', ') || 'none'}` };
    return { urn: org.urn, label: org.name };
  }
  // Bare 'organization' = first one if only one is admin'd
  if (requested === 'organization' || requested === 'org' || requested === 'page') {
    if (orgs.length === 0) return { error: 'You don\'t admin any LinkedIn Pages — post as person instead.' };
    if (orgs.length === 1) return { urn: orgs[0].urn, label: orgs[0].name };
    return { error: `Multiple Pages available — specify by name: ${orgs.map(o => o.name).join(', ')}` };
  }
  // Vanity or name match
  const lower = String(requested).toLowerCase();
  const match = orgs.find((o) => o.vanity?.toLowerCase() === lower || o.name?.toLowerCase().includes(lower));
  if (match) return { urn: match.urn, label: match.name };

  return { error: `Couldn't resolve author "${requested}". Available: you, or Pages [${orgs.map(o => o.name).join(', ') || 'none'}]` };
}

/**
 * Publish a post to LinkedIn. Author defaults to the personal feed; pass
 * `author: 'organization'` (or a specific Page URN / vanity / name) to post
 * as a Company Page the user admins.
 */
export async function publishPost({ commentary, visibility = 'PUBLIC', author = 'person' }) {
  if (!commentary?.trim()) return { error: 'No post body provided.' };

  const auth = await getValidAccessToken();
  if (!auth) {
    return { error: 'LinkedIn not connected. Visit http://localhost:3001/auth/linkedin to authorize.' };
  }

  const resolved = resolveAuthor(author, auth);
  if (resolved.error) return { error: resolved.error };

  const body = {
    author:                    resolved.urn,
    commentary:                commentary,
    visibility:                visibility,           // PUBLIC | CONNECTIONS
    distribution:              { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState:            'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch(POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization:              `Bearer ${auth.accessToken}`,
      'Content-Type':             'application/json',
      'LinkedIn-Version':         API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `LinkedIn API ${res.status} posting as ${resolved.label}: ${text.slice(0, 300)}` };
  }

  // LinkedIn returns the new post URN in the x-restli-id header
  const postUrn = res.headers.get('x-restli-id') || res.headers.get('X-RestLi-Id');
  return {
    success: true,
    postedAs: resolved.label,
    postUrn,
    url: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : null,
    visibility,
  };
}

/** Return the set of valid authors (person + admin'd Pages). Used by ARIA when asking Randy who to post as. */
export async function getTargets() {
  const auth = await loadAuth();
  if (!auth) return { connected: false };
  const orgs = auth.organizations || [];
  return {
    connected: true,
    person: { urn: auth.member_urn, label: auth.member_name || 'You (personal feed)' },
    organizations: orgs,
    multipleChoices: orgs.length > 0,
  };
}
