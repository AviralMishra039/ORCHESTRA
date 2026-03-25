const axios = require('axios');
const pptxParser = require('pptx-text-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function parsePptx(fileSource) {
  let isTemp = false;
  let filePath = fileSource;
  
  try {
    if (typeof fileSource === 'string' && fileSource.startsWith('http')) {
      isTemp = true;
      const response = await axios({
        url: fileSource,
        method: 'GET',
        responseType: 'stream'
      });
      filePath = path.join(os.tmpdir(), `orchestra_temp_${Date.now()}.pptx`);
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    }

    const doc = await pptxParser(filePath);
    let text = "";
    if (typeof doc === 'string') {
      text = doc;
    } else {
      text = JSON.stringify(doc, null, 2);
    }
    return `\n=== PITCH DECK CONTENT ===\n${text}\n`;
  } catch (err) {
    console.error("PPTX parse failed:", err.message);
    return `\n=== PITCH DECK CONTENT ===\n[Failed to extract text from PPTX: ${err.message}]\n`;
  } finally {
    if (isTemp && filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
}

async function parseGithub(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return `\n=== GITHUB REPO ===\n[Invalid GitHub URL: ${url}]\n`;
  
  const user = match[1];
  let repo = match[2];
  if (repo.endsWith('.git')) repo = repo.slice(0, -4);

  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const baseUrl = `https://api.github.com/repos/${user}/${repo}`;
    
    const metaRes = await axios.get(baseUrl, { headers });
    const { description, language, created_at, open_issues_count } = metaRes.data;

    let output = `\n=== GITHUB METADATA ===\n`;
    output += `Description: ${description || 'N/A'}\n`;
    output += `Primary Language: ${language || 'N/A'}\n`;
    output += `Created At: ${created_at}\n`;
    output += `Open Issues: ${open_issues_count}\n\n`;

    try {
      const langRes = await axios.get(`${baseUrl}/languages`, { headers });
      const langs = Object.entries(langRes.data).map(([l, bytes]) => `${l}: ${bytes} bytes`).join(', ');
      if (langs) output += `=== LANGUAGE BREAKDOWN ===\n${langs}\n\n`;
    } catch(e) {}

    try {
      const readmeRes = await axios.get(`${baseUrl}/readme`, { 
        headers: { ...headers, 'Accept': 'application/vnd.github.raw' } 
      });
      let readme = readmeRes.data;
      if (typeof readme !== 'string') readme = JSON.stringify(readme);
      if (readme.length > 10000) {
        readme = readme.substring(0, 10000) + "... [truncated for length]";
      }
      output += `=== README ===\n${readme}\n\n`;
    } catch(e) {}

    try {
      const treeRes = await axios.get(`${baseUrl}/git/trees/HEAD?recursive=1`, { headers });
      if (treeRes.data && treeRes.data.tree) {
        const files = treeRes.data.tree.map(t => t.path).join('\n');
        output += `=== FILE STRUCTURE ===\n${files}\n\n`;
      }
    } catch(e) {}

    try {
      const commitRes = await axios.get(`${baseUrl}/commits?per_page=10`, { headers });
      const commits = commitRes.data.map(c => `- ${c.commit.author.date}: ${c.commit.message}`).join('\n');
      output += `=== RECENT COMMITS (last 10) ===\n${commits}\n\n`;
    } catch(e) {}

    return output;
  } catch (err) {
    console.error("GitHub parse failed:", err.response?.status, err.message);
    return `\n=== GITHUB REPO ===\n[Failed to fetch repo data: ${err.message}]\n`;
  }
}

async function parserPipeline(files, inputs) {
  let combinedContent = "";

  const pptxSource = inputs.pptx_url || (files && files.pptx_file ? files.pptx_file.path : null);

  if (pptxSource && pptxSource.trim() !== "") {
    const pptxText = await parsePptx(pptxSource.trim());
    combinedContent += pptxText;
  }

  if (inputs.github_url && inputs.github_url.trim() !== "") {
    const ghText = await parseGithub(inputs.github_url.trim());
    combinedContent += ghText;
  }

  if (inputs.prototype_url && inputs.prototype_url.trim() !== "") {
    combinedContent += `\n=== PROTOTYPE LINK ===\n${inputs.prototype_url.trim()}\n`;
  }

  return combinedContent;
}

module.exports = { parserPipeline };
