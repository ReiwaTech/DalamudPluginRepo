import fs, { readdirSync } from 'fs';
import { join } from 'path';

const DEFAULTS = {
  IsHide: false,
  IsTestingExclusive: false,
  ApplicableVersion: 'any',
};

const TRIMMED_KEYS = [
  'Author',
  'Name',
  'Punchline',
  'Description',
  'Changelog',
  'InternalName',
  'AssemblyVersion',
  'RepoUrl',
  'ApplicableVersion',
  'Tags',
  'CategoryTags',
  'DalamudApiLevel',
  'IconUrl',
  'ImageUrls',
];

const extractManifests = function () {
  const manifests = [];

  const dir = './plugins';
  for (const pluginName of readdirSync(dir)) {
    const fileName = join(dir, pluginName, `${pluginName}.json`);
    try {
      const manifest = JSON.parse(fs.readFileSync(fileName, 'utf-8'));
      manifests.push(manifest);
    } catch (e) {}
  }

  return manifests;
};

const getReleaseDownloadCount = async function (username, repo, id) {
  const url = `https://api.github.com/repos/${username}/${repo}/releases/tags/v${id}`;

  try {
    let count = 0;
    const res = await fetch(url);
    const data = await res.json();

    for (const asset of data.assets) {
      count += asset.download_count;
    }

    return count;
  } catch (e) {
    console.error(`Failed processing ${url}`, e);
    return 0;
  }
};

const addExtraFields = async function (manifest) {
  // generate the download link
  const repoUrl =
    manifest.RepoUrl ||
    `https://github.com/${manifest.Author}/${manifest.Name}`;
  const downloadLink = `${repoUrl}/releases/download/v${manifest.AssemblyVersion}/latest.zip`;

  return {
    ...manifest,
    RepoUrl: repoUrl,
    DownloadLinkInstall: downloadLink,
    DownloadLinkTesting: downloadLink,
    DownloadLinkUpdate: downloadLink,
    // add default values if missing
    ...DEFAULTS,

    DownloadCount: await getReleaseDownloadCount(
      'ReiwaTech',
      manifest.InternalName,
      manifest.AssemblyVersion
    ),
  };
};

const getLastUpdatedTimes = (() => {
  let previousManifests = [];
  try {
    previousManifests = JSON.parse(
      fs.readFileSync('pluginmaster.json', 'utf-8')
    );
  } catch (e) {}

  return (manifest) => {
    const prev = previousManifests.find(
      (item) => item.InternalName === manifest.InternalName
    );

    return {
      ...manifest,
      LastUpdate:
        prev && prev.AssemblyVersion === manifest.AssemblyVersion
          ? prev.LastUpdate
          : Math.floor(Date.now() / 1000).toString(),
    };
  };
})();

const writeMaster = function (master) {
  fs.writeFileSync('pluginmaster.json', JSON.stringify(master, null, 4));
};

const trimManifest = function (plugin) {
  return Object.fromEntries(
    Object.entries(plugin).filter(([k]) => TRIMMED_KEYS.includes(k))
  );
};

(async () => {
  const master = await Promise.all(
    // extract the manifests from the repository
    extractManifests()
      // trim the manifests
      .map(trimManifest)
      // convert the list of manifests into a master list
      .map(addExtraFields)
      // update LastUpdate fields
      .map((p) => p.then(getLastUpdatedTimes))
  );

  // write the master
  writeMaster(master);
})();
