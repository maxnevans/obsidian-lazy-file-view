import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const TRANSPARENT_PNG =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const root = resolve(import.meta.dirname, '..', '.test-vault');
const documents = resolve(root, 'Documents');
const attachments = resolve(root, 'Attachments');
const ffmpegPath = process.env.FFMPEG_PATH?.trim() || 'ffmpeg';
const hasFfmpeg = spawnSync(ffmpegPath, ['-version'], { stdio: 'ignore' }).status === 0;

await Promise.all([
	mkdir(documents, { recursive: true }),
	mkdir(attachments, { recursive: true }),
	mkdir(resolve(root, '.obsidian'), { recursive: true }),
]);

await writeFile(
	resolve(root, 'Test.md'),
	`# Embed tests

## PDF

![[Documents/small.pdf]]

## Image

![[Attachments/image.png]]

## Audio

![[Attachments/sample.wav]]

## Video

${hasFfmpeg ? '![[Attachments/sample.mp4]]' : '_Add a valid `Attachments/sample.mp4` to test native video embeds._'}

## Direct-link tests

[[Documents/small.pdf]]
[[Attachments/image.png]]
${hasFfmpeg ? '[[Attachments/sample.mp4]]' : ''}
[[Attachments/sample.wav]]
[[Documents/test.docx]]
[[Documents/test.xlsx]]
[[Documents/archive.zip]]
`,
);
await writeFile(
	resolve(root, '.obsidian', 'app.json'),
	`${JSON.stringify({ showUnsupportedFiles: true }, null, 2)}\n`,
);
await writeFile(
	resolve(root, '.obsidian', 'community-plugins.json'),
	`${JSON.stringify(['lazy-file-view'], null, 2)}\n`,
);
await writeFile(resolve(documents, 'small.pdf'), createPdf('Lazy File View test PDF'));
await writeFile(resolve(documents, 'large.pdf'), createPdf('Replace with a large PDF for performance testing'));
await writeFile(resolve(attachments, 'image.png'), Buffer.from(TRANSPARENT_PNG, 'base64'));
await writeFile(resolve(attachments, 'sample.wav'), createWav());
await writeFile(resolve(documents, 'test.docx'), createDocx());
await writeFile(resolve(documents, 'test.xlsx'), createXlsx());
await writeFile(
	resolve(documents, 'archive.zip'),
	createZip([{ name: 'README.txt', data: 'Lazy File View archive fixture.\n' }]),
);

await rm(resolve(attachments, 'large.jpg'), { force: true });
await rm(resolve(attachments, 'sample.mp3'), { force: true });
if (hasFfmpeg) {
	const video = spawnSync(
		ffmpegPath,
		[
			'-y',
			'-f',
			'lavfi',
			'-i',
			'color=c=black:s=320x180:d=1',
			'-pix_fmt',
			'yuv420p',
			resolve(attachments, 'sample.mp4'),
		],
		{ stdio: 'ignore' },
	);
	if (video.status !== 0) {
		await rm(resolve(attachments, 'sample.mp4'), { force: true });
	}
} else {
	await rm(resolve(attachments, 'sample.mp4'), { force: true });
}

await writeFile(
	resolve(root, 'TESTING.md'),
	`# Manual testing

This vault is generated and ignored by source control. It contains valid lightweight PDF, PNG, WAV, DOCX, XLSX, and ZIP fixtures. Replace the files named \`large.*\` with representative large files before performance testing.

The MP4 fixture is generated when ffmpeg is installed. If it is absent, add a valid \`Attachments/sample.mp4\` before testing video behavior.
`,
);

console.log(`Created test vault at ${root}`);

function createPdf(text) {
	const stream = `BT /F1 18 Tf 72 720 Td (${escapePdf(text)}) Tj ET`;
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
		`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
	];
	let output = '%PDF-1.4\n';
	const offsets = [0];
	for (const [index, object] of objects.entries()) {
		offsets.push(Buffer.byteLength(output));
		output += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}
	const xrefOffset = Buffer.byteLength(output);
	output += `xref\n0 ${objects.length + 1}\n`;
	output += '0000000000 65535 f \n';
	for (const offset of offsets.slice(1)) {
		output += `${String(offset).padStart(10, '0')} 00000 n \n`;
	}
	output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
	return output;
}

function escapePdf(value) {
	return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function createWav() {
	const sampleRate = 8_000;
	const sampleCount = 800;
	const dataSize = sampleCount * 2;
	const output = Buffer.alloc(44 + dataSize);
	output.write('RIFF', 0);
	output.writeUInt32LE(36 + dataSize, 4);
	output.write('WAVEfmt ', 8);
	output.writeUInt32LE(16, 16);
	output.writeUInt16LE(1, 20);
	output.writeUInt16LE(1, 22);
	output.writeUInt32LE(sampleRate, 24);
	output.writeUInt32LE(sampleRate * 2, 28);
	output.writeUInt16LE(2, 32);
	output.writeUInt16LE(16, 34);
	output.write('data', 36);
	output.writeUInt32LE(dataSize, 40);
	return output;
}

function createDocx() {
	return createZip([
		{
			name: '[Content_Types].xml',
			data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
		},
		{
			name: '_rels/.rels',
			data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
		},
		{
			name: 'word/document.xml',
			data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Lazy File View DOCX fixture</w:t></w:r></w:p><w:sectPr/></w:body></w:document>',
		},
	]);
}

function createXlsx() {
	return createZip([
		{
			name: '[Content_Types].xml',
			data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
		},
		{
			name: '_rels/.rels',
			data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
		},
		{
			name: 'xl/workbook.xml',
			data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Fixture" sheetId="1" r:id="rId1"/></sheets></workbook>',
		},
		{
			name: 'xl/_rels/workbook.xml.rels',
			data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
		},
		{
			name: 'xl/worksheets/sheet1.xml',
			data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Lazy File View XLSX fixture</t></is></c></row></sheetData></worksheet>',
		},
	]);
}

function createZip(entries) {
	const localParts = [];
	const centralParts = [];
	let offset = 0;

	for (const entry of entries) {
		const name = Buffer.from(entry.name, 'utf8');
		const data = Buffer.isBuffer(entry.data)
			? entry.data
			: Buffer.from(entry.data, 'utf8');
		const crc = crc32(data);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0x0800, 6);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(name.length, 26);
		localParts.push(local, name, data);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE(offset, 42);
		centralParts.push(central, name);
		offset += local.length + name.length + data.length;
	}

	const centralDirectory = Buffer.concat(centralParts);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(centralDirectory.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(data) {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}
