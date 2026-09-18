const { normalizeUploadRelativePath } = require('../../src/middleware/serveUploads');

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
});
