import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POSTS_DIR = new URL('../src/posts/', import.meta.url);

const API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `你是专业总结助手，请用一句话精炼总结文章（忽略截断）；须用第三人称，原博文中"我"统一称为"博主"，用"这篇博文"指代文章本身；严禁以"这篇文章由博主撰写"等废话开头，直接陈述核心内容。`;

function stripNoise(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '「代码块」')
    .replace(/`[^`]+`/g, '「代码」')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function genSummary(postContent) {
  if (!API_KEY) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const cleanContent = stripNoise(postContent).slice(0, 8000);

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 200,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: cleanContent },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API request failed: (${res.status}): ${err}`);
  }

  const data = await res.json();
  const summary = data.choices[0].message.content.trim();

  return summary.replace(/^["'""]|["'""]$/g, '');
}

async function processFile(filePath) {
  const content = await readFile(filePath, 'utf-8');

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return;

  const fm = fmMatch[1];

  if (/^summary:\s*.+/m.test(fm)) {
    console.log(`summary already exists, skipping: ${filePath}`);
    return;
  }

  const postMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)/);
  if (!postMatch) {
    console.warn(`No post content found, skipping: ${filePath}`);
    return;
  }
  const postContent = postMatch[1];

  const summary = await genSummary(postContent);

  const newFm = fm + `\nsummary: "${summary}"`;
  const newContent = content.replace(fmMatch[1], newFm);

  await writeFile(filePath, newContent, 'utf-8');
  console.log(`summary generated: ${summary} → ${filePath}`);
}

const files = (await readdir(POSTS_DIR))
  .filter((f) => f.endsWith('.md'))
  .map((f) => join(POSTS_DIR.pathname, f));

for (const f of files) {
  await processFile(f);
}
