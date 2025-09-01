import { parseArgs } from '../src/cli';

describe('CLI parseArgs', () => {
  it('parses flags and positional', () => {
    const args = parseArgs(['node', 'bin', 'ingest', '--file', 'f.jsonl', '--provider', 'openai-chat', '--dry-run']);
    expect(args._).toBe('ingest');
    expect(args['file']).toBe('f.jsonl');
    expect(args['provider']).toBe('openai-chat');
    expect(args['dry-run']).toBe(true);
  });
});
