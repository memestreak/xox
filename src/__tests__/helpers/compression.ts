/**
 * Polyfill CompressionStream/DecompressionStream and replace
 * jsdom's Blob with Node's Blob for jsdom test environment.
 *
 * Uses the real Node.js implementations so round-trip tests
 * exercise actual deflate-raw compression.
 */
import { Blob as NodeBlob } from 'node:buffer';
import {
  CompressionStream,
  DecompressionStream,
} from 'node:stream/web';

Object.assign(globalThis, {
  Blob: NodeBlob,
  CompressionStream,
  DecompressionStream,
});
