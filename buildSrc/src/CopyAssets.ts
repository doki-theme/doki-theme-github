import { resolvePaths, walkDir } from "doki-build-source";
import path from "path";
import fs from 'fs';

const { repoDirectory } = resolvePaths(__dirname);

const dokiThemeAssets = path.resolve(
  repoDirectory,
  "..",
  "doki-theme-assets",
  "stickers",
  "vscode"
);

walkDir(dokiThemeAssets).then((assetPaths) => {
  const stickerAssets = assetPaths.filter(
    (assetPath) => !assetPath.endsWith("checksum.txt")
  );

  stickerAssets.forEach((dokiStickerAssetPath) => {
    const githubStickerAsset = path.resolve(
      repoDirectory,
      "assets",
      "stickers"
    );
    const githubStickerPath = path.join(
      githubStickerAsset,
      dokiStickerAssetPath.substr(dokiThemeAssets.length)
    );
    const githubAssetExists = fs.existsSync(githubStickerPath);
    if(!githubAssetExists) {
      console.log('copying over ', dokiStickerAssetPath);
      
      fs.mkdirSync(path.resolve(githubStickerPath, ".."), {
        recursive: true,
      });

      fs.copyFileSync(
        dokiStickerAssetPath, githubStickerPath
      )
    }
  });
});
