const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { normalizeUploadRelativePath, serveUploads, contentDispositionAttachment } = require('../../src/middleware/serveUploads');

describe('serveUploads path normalization', () => {
  test('strips /uploads prefix from originalUrl', () => {
    expect(
      normalizeUploadRelativePath(
        '/uploads/candidates/86376044-e1ab-44df-93b8-d3912f668acb/521c5f02-7bec-4d0a-a792-ae152fa54799.pdf'
      )
    ).toBe('candidates/86376044-e1ab-44df-93b8-d3912f668acb/521c5f02-7bec-4d0a-a792-ae152fa54799.pdf');
  });

  test('accepts a mount-relative path', () => {
    expect(
      normalizeUploadRelativePath('/candidates/abc/file.pdf')
    ).toBe('candidates/abc/file.pdf');
  });

  test('Content-Disposition keeps the original upload name', () => {
    const header = contentDispositionAttachment('PMO - Change Request PO integration.pdf');
    expect(header).toContain('filename="PMO - Change Request PO integration.pdf"');
    expect(header).toContain("filename*=UTF-8''PMO%20-%20Change%20Request%20PO%20integration.pdf");
  });
});

describe('serveUploads end to end', () => {
  let tmpRoot;
  let app;
  const pdfBytes = Buffer.from('%PDF-1.4 test file');

  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tas-uploads-'));
    const dir = path.join(tmpRoot, 'candidates', 'cand-1');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'doc-1.pdf'), pdfBytes);

    process.env.STORAGE_LOCAL_PATH = tmpRoot;
    app = express();
    app.use('/uploads', serveUploads);
  });

  afterAll(() => {
    delete process.env.STORAGE_LOCAL_PATH;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('GET serves an existing PDF with the right headers', async () => {
    const res = await request(app).get('/uploads/candidates/cand-1/doc-1.pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['x-tas-uploads']).toBe('hit');
    expect(res.headers['content-disposition']).toContain('inline;');
    expect(res.headers['content-disposition']).toContain('filename="doc-1.pdf"');
    expect(res.body.equals(pdfBytes)).toBe(true);
  });

  test('HEAD returns 200 for an existing PDF', async () => {
    const res = await request(app).head('/uploads/candidates/cand-1/doc-1.pdf');
    expect(res.status).toBe(200);
    expect(res.headers['x-tas-uploads']).toBe('hit');
  });

  test('missing file returns JSON 404 with X-TAS-Uploads: miss', async () => {
    const res = await request(app).get('/uploads/candidates/cand-1/nope.pdf');
    expect(res.status).toBe(404);
    expect(res.headers['x-tas-uploads']).toBe('miss');
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.roots).toBeUndefined();
    expect(res.body.path).toBeUndefined();
  });

  test('download=1 forces attachment', async () => {
    const res = await request(app).get('/uploads/candidates/cand-1/doc-1.pdf?download=1');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment;');
  });
});
