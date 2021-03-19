import {
  BaseAppDokiThemeDefinition,
  constructNamedColorTemplate,
  DokiThemeDefinitions,
  evaluateTemplates,
  fillInTemplateScript,
  MasterDokiThemeDefinition,
  resolvePaths,
  resolveStickerPath
} from 'doki-build-source';

type GitHubDokiThemeDefinition = BaseAppDokiThemeDefinition;

const path = require('path');

const fs = require('fs');

const {
  repoDirectory,
  templateDirectoryPath,
} = resolvePaths(__dirname);

const themesOutputDirectoryTemplateDirectoryPath = path.resolve(
  repoDirectory,
  'themes',
);


function constructGitHubName(dokiTheme: MasterDokiThemeDefinition) {
  return dokiTheme.name.replace(/ /g, '_').toLowerCase();
}

function buildCssTemplate(
  dokiThemeDefinition: MasterDokiThemeDefinition,
  dokiTemplateDefinitions: DokiThemeDefinitions,
  dokiFileDefinitionPath: string,
  dokiThemeGitHubDefinition: GitHubDokiThemeDefinition,
  githubCssTemplate: string,
) {
  return evaluateTemplate(
    dokiThemeDefinition,
    dokiThemeGitHubDefinition,
    dokiTemplateDefinitions,
    dokiFileDefinitionPath,
    githubCssTemplate
  );
}

const capitalize = require('lodash/capitalize');

const packageJson = JSON.parse(fs.readFileSync(path.resolve(
  repoDirectory, "package.json"
), {encoding: "utf-8"}));

function evaluateTemplate(
  dokiThemeDefinition: MasterDokiThemeDefinition,
  dokiThemeGitHubDefinition: GitHubDokiThemeDefinition,
  dokiTemplateDefinitions: DokiThemeDefinitions,
  dokiFileDefinitionPath: string,
  gitHubCss: string,
) {
  const namedColors = constructNamedColorTemplate(
    dokiThemeDefinition, dokiTemplateDefinitions,
  );
  const themeName = constructGitHubName(dokiThemeDefinition);
  const themeProperName = dokiThemeDefinition.name.split(" ")
    .map(part => capitalize(part))
    .join('');

  try {
    return fillInTemplateScript(
      gitHubCss,
      {
        ...namedColors,
        ...dokiThemeGitHubDefinition.colors,
        displayName: dokiThemeDefinition.name,
        version: packageJson.version,
        themeName,
        themeProperName,
        stickerPath: resolveStickerPath(
          dokiFileDefinitionPath,
          dokiThemeDefinition.stickers.default,
          __dirname
        ),
        accentColorEditor: dokiThemeDefinition.overrides?.editorScheme?.colors?.accentColor ||
          dokiThemeDefinition.colors.accentColor,
      }
    );
  } catch (e) {
    throw Error(`Unable to evaluate ${dokiThemeDefinition.name}'s template for raisins: ${e.message}.`);
  }
}


function createDokiTheme(
  dokiFileDefinitionPath: string,
  dokiThemeDefinition: MasterDokiThemeDefinition,
  dokiTemplateDefinitions: DokiThemeDefinitions,
  dokiThemeGitHubDefinition: GitHubDokiThemeDefinition,
) {
  try {
    return {
      path: dokiFileDefinitionPath,
      definition: dokiThemeDefinition,
      applyNamedColors: (css: string) => buildCssTemplate(
        dokiThemeDefinition,
        dokiTemplateDefinitions,
        dokiFileDefinitionPath,
        dokiThemeGitHubDefinition,
        css
      )
    };
  } catch (e) {
    throw new Error(`Unable to build ${dokiThemeDefinition.name}'s theme for reasons ${e}`);
  }
}


console.log('Preparing to generate themes.');

evaluateTemplates(
  {
    appName: 'github',
    currentWorkingDirectory: __dirname,
  },
  createDokiTheme
)
  .then(dokiThemes =>
    Promise.resolve()
      // local cached CSS (fast)
      .then(() => fs.readFileSync(path.resolve(templateDirectoryPath, 'tempCss.css.txt'), {encoding: "utf-8"}))
      .then(baseCssTemplate => {
        console.log('Css Re-Mapped');
        // write css files
        dokiThemes.forEach(dokiTheme => {
          const mappedTemplateCss = dokiTheme.applyNamedColors(baseCssTemplate)
          const themeName = constructGitHubName(dokiTheme.definition);
          fs.writeFileSync(
            path.resolve(themesOutputDirectoryTemplateDirectoryPath, `${themeName}.user.css`),
            mappedTemplateCss
          );
        });
      }))
  .then(() => {
    console.log('Theme Generation Complete!');
  });
