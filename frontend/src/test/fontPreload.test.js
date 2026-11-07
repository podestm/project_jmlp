import { describe, expect, it } from 'vitest';
import { fontPreloadTags } from '../../vite/fontPreload.js';

describe('preload písem Modré stopy', () => {
  it('vrátí preload jen pro woff2 písem latin a latin-ext, seřazené', () => {
    const bundle = {
      'assets/source-sans-3-latin-400-normal-Ab12.woff2': {},
      'assets/archivo-latin-ext-700-normal-Cd34.woff2': {},
      'assets/archivo-latin-ext-700-normal-Cd34.woff': {},
      'assets/index-Ef56.css': {},
      'assets/bootstrap-icons-Gh78.woff2': {},
    };

    const tags = fontPreloadTags(bundle);

    expect(tags.map((t) => t.attrs.href)).toEqual([
      '/assets/archivo-latin-ext-700-normal-Cd34.woff2',
      '/assets/source-sans-3-latin-400-normal-Ab12.woff2',
    ]);
    expect(tags[0]).toMatchObject({
      tag: 'link',
      injectTo: 'head',
      attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '' },
    });
  });
});
