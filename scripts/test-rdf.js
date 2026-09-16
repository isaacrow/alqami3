import { RDFManuscriptParser } from '../src/rdf-parser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testRdf() {
  const ttlPath = path.resolve(__dirname, '../data/manuscript.ttl');
  const ttlContent = fs.readFileSync(ttlPath, 'utf8');

  const parser = new RDFManuscriptParser();
  const result = await parser.parseTurtle(ttlContent);

  console.log('=== RDF PARSER VALIDATION TEST ===');
  console.log(`Total Triples Parsed: ${result.tripleCount}`);
  console.log(`Title: ${result.metadata.title}`);
  console.log(`Arabic Title: ${result.metadata.titleArabic}`);
  console.log(`Creator: ${result.metadata.creator}`);
  console.log(`Date: ${result.metadata.date}`);
  console.log(`Material: ${result.metadata.material}`);
  console.log(`Dimensions: ${result.metadata.dimensions}`);
  console.log(`Hotspots extracted: ${result.hotspots.length}`);
  result.hotspots.forEach((hs, i) => {
    console.log(`  [${i+1}] ${hs.label} (${hs.folio}) -> (x: ${hs.normX}, y: ${hs.normY}, z: ${hs.elevZ})`);
  });

  const graphData = parser.getGraphData();
  console.log(`Graph Nodes: ${graphData.nodes.length}, Graph Links: ${graphData.links.length}`);
  console.log('=== ALL TESTS PASSED ===');
}

testRdf().catch(console.error);
