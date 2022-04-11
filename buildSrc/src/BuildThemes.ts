import {
  BaseAppDokiThemeDefinition,
  constructNamedColorTemplate,
  DokiThemeDefinitions,
  evaluateTemplates,
  fillInTemplateScript,
  getColorFromTemplate,
  MasterDokiThemeDefinition,
  resolveColor,
  resolvePaths,
} from 'doki-build-source';

type GitHubDokiThemeDefinition = BaseAppDokiThemeDefinition;

const path = require('path');

const fs = require('fs');

const {
  repoDirectory,
  masterThemeDefinitionDirectoryPath,
  appTemplatesDirectoryPath,
} = resolvePaths(__dirname);

function resolveStickerPath(
  themeDefinitionPath: string,
  sticker: string,
) {
  const stickerPath = path.resolve(
    path.resolve(themeDefinitionPath, '..'),
    sticker
  );
  return stickerPath.substr(masterThemeDefinitionDirectoryPath.length + '/definitions'.length)
  .replace(/\\/g, '/');
}

const themesOutputDirectoryTemplateDirectoryPath = path.resolve(
  repoDirectory,
  'themes',
);


function constructGitHubName(dokiTheme: MasterDokiThemeDefinition) {
  return getName(dokiTheme).replace(/ /g, '_').toLowerCase();
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
  const themeProperName = getName(dokiThemeDefinition).split(" ")
    .map(part => capitalize(part))
    .join('');

  try {
    return fillInTemplateScript(
      gitHubCss,
      {
        ...namedColors,
        ...dokiThemeGitHubDefinition.colors,
        displayName: getName(dokiThemeDefinition),
        version: packageJson.version,
        themeName,
        themeProperName,
        stickerPath: resolveStickerPath(
          dokiFileDefinitionPath,
          dokiThemeDefinition.stickers.default.name,
        ),
        accentColorEditor: dokiThemeDefinition.overrides?.editorScheme?.colors?.accentColor ||
          dokiThemeDefinition.colors.accentColor,
        lightnessThreshold: dokiThemeDefinition.dark ? 0.6 : 0.453,
        issueLabelColor: dokiThemeDefinition.dark ? 'hsl(var(--label-h), calc(var(--label-s) * 1%), calc((var(--label-l) + var(--lighten-by)) * 1%))' : 'hsl(0deg, 0%, calc(var(--lightness-switch) * 100%))',
        issueLabelBackground: dokiThemeDefinition.dark ? 'rgba(var(--label-r), var(--label-g), var(--label-b), var(--background-alpha))' : 'rgb(var(--label-r), var(--label-g), var(--label-b));',
      },
      (templateVariable, templateVariables) => {
        const colorFromTemplate = getColorFromTemplate(templateVariables, templateVariable);
        if(typeof colorFromTemplate === 'number') {
          return colorFromTemplate;
        }

        const hexColor = resolveColor(
          colorFromTemplate,
          templateVariables
        );
        return hexColor;
      }
    );
  } catch (e) {
    throw Error(`Unable to evaluate ${dokiThemeDefinition.name}'s template for raisins: ${e.message}.`);
  }
}


function createDokiTheme(
  dokiFileDefinitionPath: string,
  dokiThemeDefinition: MasterDokiThemeDefinition,
  _: DokiThemeDefinitions,
  dokiThemeGitHubDefinition: GitHubDokiThemeDefinition,
  dokiTemplateDefinitions: DokiThemeDefinitions,
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
      .then(() => fs.readFileSync(path.resolve(appTemplatesDirectoryPath, 'tempCss.css.txt'), {encoding: "utf-8"}))
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

  function getName(dokiDefinition: MasterDokiThemeDefinition) {
  return dokiDefinition.name.replace(':', '');
}
