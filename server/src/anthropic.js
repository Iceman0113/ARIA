import Anthropic from '@anthropic-ai/sdk';

let _client = null;

export function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// Test hook — never call from production code.
export function _resetForTest() {
  _client = null;
}
