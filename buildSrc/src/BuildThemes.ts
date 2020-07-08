// @ts-ignore
import {DokiThemeDefinitions, MasterDokiThemeDefinition, StringDictonary, GitHubDokiThemeDefinition} from './types';
import {cssMappings, cssSources, ignoreSelectors} from "./CSSStuff";
import fetchCssLocal from './FetchCSS';

const remapCss = require('remap-css');

const path = require('path');

const repoDirectory = path.resolve(__dirname, '..', '..');

const fs = require('fs');

const masterThemeDefinitionDirectoryPath =
  path.resolve(repoDirectory, 'masterThemes');

const githubThemeDefinitionDirectoryPath = path.resolve(
  '.',
  "themes",
  "definitions"
);

const githubTemplateDirectoryPath = path.resolve(
  '.',
  "templates",
);

const themesOutputDirectoryTemplateDirectoryPath = path.resolve(
  repoDirectory,
  'themes',
);


function walkDir(dir: string): Promise<string[]> {
  const values: Promise<string[]>[] = fs.readdirSync(dir)
    .map((file: string) => {
      const dirPath: string = path.join(dir, file);
      const isDirectory = fs.statSync(dirPath).isDirectory();
      if (isDirectory) {
        return walkDir(dirPath);
      } else {
        return Promise.resolve([path.join(dir, file)]);
      }
    });
  return Promise.all(values)
    .then((scannedDirectories) => scannedDirectories
      .reduce((accum, files) => accum.concat(files), []));
}

const LAF_TYPE = 'laf';
const SYNTAX_TYPE = 'syntax';
const NAMED_COLOR_TYPE = 'colorz';

function getTemplateType(templatePath: string) {
  if (templatePath.endsWith('laf.template.json')) {
    return LAF_TYPE;
  } else if (templatePath.endsWith('syntax.template.json')) {
    return SYNTAX_TYPE;
  } else if (templatePath.endsWith('colors.template.json')) {
    return NAMED_COLOR_TYPE;
  }
  return undefined;
}


function resolveTemplate<T, R>(
  childTemplate: T,
  templateNameToTemplate: StringDictonary<T>,
  attributeResolver: (t: T) => R,
  parentResolver: (t: T) => string,
): R {
  if (!parentResolver(childTemplate)) {
    return attributeResolver(childTemplate);
  } else {
    const parent = templateNameToTemplate[parentResolver(childTemplate)];
    const resolvedParent = resolveTemplate(
      parent,
      templateNameToTemplate,
      attributeResolver,
      parentResolver
    );
    return {
      ...resolvedParent,
      ...attributeResolver(childTemplate)
    };
  }
}


function resolveColor(
  color: string,
  namedColors: StringDictonary<string>
): string {
  const startingTemplateIndex = color.indexOf('&');
  if (startingTemplateIndex > -1) {
    const lastDelimiterIndex = color.lastIndexOf('&');
    const namedColor =
      color.substring(startingTemplateIndex + 1, lastDelimiterIndex);
    const namedColorValue = namedColors[namedColor];
    if (!namedColorValue) {
      throw new Error(`Named color: '${namedColor}' is not present!`);
    }

    // todo: check for cyclic references
    if (color === namedColorValue) {
      throw new Error(`Very Cheeky, you set ${namedColor} to resolve to itself 😒`);
    }

    const resolvedNamedColor = resolveColor(namedColorValue, namedColors);
    if (!resolvedNamedColor) {
      throw new Error(`Cannot find named color '${namedColor}'.`);
    }
    return resolvedNamedColor + color.substring(lastDelimiterIndex + 1) || '';
  }

  return color;
}

function applyNamedColors(
  objectWithNamedColors: StringDictonary<string>,
  namedColors: StringDictonary<string>,
): StringDictonary<string> {
  return Object.keys(objectWithNamedColors)
    .map(key => {
      const color = objectWithNamedColors[key];
      const resolvedColor = resolveColor(
        color,
        namedColors
      );
      return {
        key,
        value: resolvedColor
      };
    }).reduce((accum: StringDictonary<string>, kv) => {
      accum[kv.key] = kv.value;
      return accum;
    }, {});
}

function constructNamedColorTemplate(
  dokiThemeTemplateJson: MasterDokiThemeDefinition,
  dokiTemplateDefinitions: DokiThemeDefinitions
) {
  const lafTemplates = dokiTemplateDefinitions[NAMED_COLOR_TYPE];
  const lafTemplate =
    (dokiThemeTemplateJson.dark ?
      lafTemplates.dark : lafTemplates.light);

  const resolvedColorTemplate =
    resolveTemplate(
      lafTemplate, lafTemplates,
      template => template.colors,
      template => template.extends
    );

  const resolvedNameColors = resolveNamedColors(
    dokiTemplateDefinitions,
    dokiThemeTemplateJson
  );

  // do not really need to resolve, as there are no
  // &someName& colors, but what ever.
  const resolvedColors =
    applyNamedColors(resolvedColorTemplate, resolvedNameColors);
  return {
    ...resolvedColors,
    ...resolvedColorTemplate,
    ...resolvedNameColors,
  };
}

function resolveNamedColors(
  dokiTemplateDefinitions: DokiThemeDefinitions,
  dokiThemeTemplateJson: MasterDokiThemeDefinition
) {
  const colorTemplates = dokiTemplateDefinitions[NAMED_COLOR_TYPE];
  return resolveTemplate(
    dokiThemeTemplateJson,
    colorTemplates,
    template => template.colors,
    // @ts-ignore
    template => template.extends ||
      template.dark !== undefined && (dokiThemeTemplateJson.dark ?
        'dark' : 'light'));
}

export interface StringDictionary<T> {
  [key: string]: T;
}

export const dictionaryReducer = <T>(
  accum: StringDictionary<T>,
  [key, value]: [string, T],
) => {
  accum[key] = value;
  return accum;
};

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
    .join('')

  try {
    return fillInTemplateScript(
      gitHubCss,
      {
        ...namedColors,
        displayName: dokiThemeDefinition.name,
        version: packageJson.version,
        themeName,
        themeProperName,
        stickerPath: resolveStickerPath(dokiFileDefinitionPath, dokiThemeDefinition.stickers.default),
      }
    );
  } catch (e) {
    throw Error(`Unable to evaluate ${dokiThemeDefinition.name}'s template for raisins: ${e.message}.`);
  }
}

function getColorFromTemplate(templateVariables: StringDictionary<string>, templateVariable: string) {
  const resolvedTemplateVariable = templateVariables[templateVariable];
  if (!resolvedTemplateVariable) {
    throw Error(`Template does not have variable ${templateVariable}`)
  }

  return resolvedTemplateVariable;
}

function resolveTemplateVariable(
  templateVariable: string,
  templateVariables: StringDictionary<string>,
): string {
  return resolveColor(getColorFromTemplate(templateVariables, templateVariable), templateVariables);
}

function fillInTemplateScript(
  templateToFillIn: string,
  templateVariables: StringDictionary<string>,
) {
  return templateToFillIn.split('\n')
    .map(line => {
      const reduce = line.split("").reduce((accum, next) => {
        if (accum.currentTemplate) {
          if (next === '}' && accum.currentTemplate.endsWith('}')) {
            // evaluate Template
            const templateVariable = accum.currentTemplate.substring(2, accum.currentTemplate.length - 1)
            accum.currentTemplate = ''
            const resolvedTemplateVariable = resolveTemplateVariable(
              templateVariable,
              templateVariables
            )
            accum.line += resolvedTemplateVariable
          } else {
            accum.currentTemplate += next
          }
        } else if (next === '{' && !accum.stagingTemplate) {
          accum.stagingTemplate = next
        } else if (accum.stagingTemplate && next === '{') {
          accum.stagingTemplate = '';
          accum.currentTemplate = '{{';
        } else if (accum.stagingTemplate) {
          accum.line += accum.stagingTemplate + next;
          accum.stagingTemplate = ''
        } else {
          accum.line += next;
        }

        return accum;
      }, {
        currentTemplate: '',
        stagingTemplate: '',
        line: '',
      });
      return reduce.line + reduce.stagingTemplate || reduce.currentTemplate;
    }).join('\n')

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

const readJson = <T>(jsonPath: string): T =>
  JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

type TemplateTypes = StringDictonary<StringDictonary<string>>;

const isTemplate = (filePath: string): boolean =>
  !!getTemplateType(filePath);

const readTemplates = (templatePaths: string[]): TemplateTypes => {
  return templatePaths
    .filter(isTemplate)
    .map(templatePath => {
      return {
        type: getTemplateType(templatePath)!!,
        template: readJson<any>(templatePath)
      };
    })
    .reduce((accum: TemplateTypes, templateRepresentation) => {
      accum[templateRepresentation.type][templateRepresentation.template.name] =
        templateRepresentation.template;
      return accum;
    }, {
      [SYNTAX_TYPE]: {},
      [LAF_TYPE]: {},
      [NAMED_COLOR_TYPE]: {},
    });
};

function resolveStickerPath(
  themeDefinitionPath: string,
  sticker: string,
) {
  const stickerPath = path.resolve(
    path.resolve(themeDefinitionPath, '..'),
    sticker
  );
  return stickerPath.substr(masterThemeDefinitionDirectoryPath.length + '/definitions'.length);
}

console.log('Preparing to generate themes.');

walkDir(githubThemeDefinitionDirectoryPath)
  .then((files) =>
    files.filter((file) => file.endsWith("github.definition.json"))
  )
  .then((dokiThemeGitHubDefinitionPaths) => {
    return {
      dokiThemeGitHubDefinitions: dokiThemeGitHubDefinitionPaths
        .map((dokiThemeGitHubDefinitionPath) =>
          readJson<GitHubDokiThemeDefinition>(dokiThemeGitHubDefinitionPath)
        )
        .reduce(
          (accum: StringDictonary<GitHubDokiThemeDefinition>, def) => {
            accum[def.id] = def;
            return accum;
          },
          {}
        ),
    };
  }).then(({dokiThemeGitHubDefinitions}) =>
  walkDir(path.resolve(masterThemeDefinitionDirectoryPath, 'templates'))
    .then(readTemplates)
    .then(dokiTemplateDefinitions => {
      return walkDir(path.resolve(masterThemeDefinitionDirectoryPath, 'definitions'))
        .then(files => files.filter(file => file.endsWith('master.definition.json')))
        .then(dokiFileDefinitionPaths => {
          return {
            dokiThemeGitHubDefinitions,
            dokiTemplateDefinitions,
            dokiFileDefinitionPaths
          };
        });
    }))
  .then(templatesAndDefinitions =>
    walkDir(path.resolve(githubTemplateDirectoryPath))
      .then(githubSyntaxPaths => {
        return {
          ...templatesAndDefinitions,
          githubSyntaxFileDefs: githubSyntaxPaths.map(syntaxPath => ({
            fileName: path.basename(syntaxPath),
            fileContents: fs.readFileSync(syntaxPath, 'utf-8'),
          }))
        }
      })
  )
  .then(templatesAndDefinitions => {
    const {
      dokiTemplateDefinitions,
      dokiThemeGitHubDefinitions,
      dokiFileDefinitionPaths
    } = templatesAndDefinitions;
    return dokiFileDefinitionPaths
      .map(dokiFileDefinitionPath => {
        const dokiThemeDefinition = readJson<MasterDokiThemeDefinition>(dokiFileDefinitionPath);
        const dokiThemeGitHubDefinition =
          dokiThemeGitHubDefinitions[dokiThemeDefinition.id];
        if (!dokiThemeGitHubDefinition) {
          throw new Error(
            `${dokiThemeDefinition.displayName}'s theme does not have a github Definition!!`
          );
        }
        return ({
          dokiFileDefinitionPath,
          dokiThemeDefinition,
          dokiThemeGitHubDefinition,
        });
      })
      .filter(pathAndDefinition =>
        (pathAndDefinition.dokiThemeDefinition.product === 'ultimate' &&
          process.env.PRODUCT === 'ultimate') ||
        pathAndDefinition.dokiThemeDefinition.product !== 'ultimate'
      )
      .map(({
              dokiFileDefinitionPath,
              dokiThemeDefinition,
              dokiThemeGitHubDefinition,
            }) =>
        createDokiTheme(
          dokiFileDefinitionPath,
          dokiThemeDefinition,
          dokiTemplateDefinitions,
          dokiThemeGitHubDefinition
        )
      );
  })

  .then(dokiThemes =>
  walkDir(path.resolve(__dirname, '..', 'temp'))
    .then(paths => paths.map(p => {
      return {
        url: p,
      }
    }))

    // local cached CSS (fast)
    .then(()=> fs.readFileSync(path.resolve(githubTemplateDirectoryPath, 'tempCss.css.txt'), {encoding:"utf-8"}))

    // remote-real css (slow)
    // .then(cssSources => fetchCssLocal(cssSources))
    // .then(cssSources => {
    //     console.log('Re-Mapping Css');
    //     return remapCss(cssSources, cssMappings, {
    //       ignoreSelectors,
    //       indentCss: 2,
    //       lineLength: 76,
    //       comments: true,
    //       stylistic: true,
    //       validate: true,
    //     });
    //   }
    // )
    // .then(remappedCss => {
    //   return fs.readFileSync(path.resolve(githubTemplateDirectoryPath, 'GitHub.template.css.txt'), {
    //     encoding: "utf-8"
    //   }).replace(/{{autoGeneratedCSS}}/g, remappedCss)
    // })
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
