Contributing
---

# Outline

- [Build Process](#build-process-high-level-overview)
- [Getting Started](#getting-started)
- [Editing Themes](#editing-themes)
- [Creating New Themes](#creating-new-themes)

# Build Process High level overview

I won't go into the minor details of the theme building process, however I will talk about the high level details of
what is accomplished.

All themes have a base template that they inherit from. Themes have the ability to choose their inherited parent. Each
child has the ability to override any attributes defined by the parent. This mitigates any one-off issues for themes
that are captured by the global shared style.

# Getting Started

Before you get started, you'll probably want to follow
the [installation instructions](https://github.com/doki-theme/doki-theme-github#prerequisites-for-full-experience)

# Editing Themes

## Editing Themes Required Software

- Yarn package manager
- Node 14

## Initial Setup

**Set up Yarn Globals**

I heavily use Node/Typescript to build all of my themes, and I have a fair amount of global tools installed.

Just run

```shell
yarn global add typescript ts-node nodemon
```

Note: if you already have these globally installed please make sure you are up to date!

```shell
yarn global upgrade typescript ts-node
```

**Get the Master Themes**

Since this theme suite expands across multiple platforms, in order to maintain consistency of the look and feel across
platforms, there is a [central theme definition repository](https://github.com/doki-theme/doki-master-theme)

This repository needs to be cloned as a directory called `masterThemes`. If you are running Linux/MacOS, you can
run `getMasterThemes.sh` located at the root of this repository. This script does exactly what is required, if you are
on Windows, have you considered Linux? Just kidding (mostly), you'll need to run this command

```shell
git clone https://github.com/doki-theme/doki-master-theme.git masterThemes
```

Your directory structure should have at least these directories, (there will probably be more, but these are the
important ones to know).

```
your-workspace/
├─ doki-theme-github/
│  ├─ masterThemes/
│  ├─ buildSrc/
```

Inside the `masterThemes` directory, you'll want to make sure all the dependencies are available to the build scripts.
To accomplish this, just run this command in the `masterThemes` directory.

```shell
yarn
```

### Set up build source

Navigate to the root of the `buildSource` directory and run the following command.

```shell
yarn
```

This will install all the required dependencies to run the theme build process.

You should be good to edit and add themes after that!

## Theme Editing Process

I have too many themes to maintain manually, so theme creation/maintenance is automated and shared common parts to
reduce overhead.

The standardized approach used by all the plugins supporting the Doki Theme suite, is that there is a `buildSrc`
directory.

Inside the `buildSrc` directory, there will be 2 directories:

- `src` - holds the code that builds the themes.
- `assets` - defines the platform specific assets needed to build the themes. This directory normally contains two child
  directories.
    - `themes` - holds the [application definitions](#application-specific-templates)
    - `templates` - if not empty, normally contains various text files that can be evaluated to replace variables with
      values. Some cases, they also contain templates for evaluating things such as look and feel, colors, and other
      things.

The `buildSrc` directory houses a `buildThemes` script that generates the application specific files necessary for apply
the Doki Theme Suite.

### GitHub specifics

There is one file that is important, it can be found in `buildSrc/assets/templates`. That file is tempCss.css.txt, which
is the template for the common user CSS that used for all themes.

This template is evaluated as part of the theme building process. When you run this command in the `buildSrc`
directory:

```shell
yarn buildThemes
```

This template will be evaluated for each theme and be placed in the corresponding directory `<repo-root>/themes` as
a `*.user.css` file.

Some themes have some one-off issues that can be fixed by adding some stuff to the `github.definition.json` file. Here
is an example of fixing a
themes [primary button](https://github.com/doki-theme/doki-theme-github/blob/master/buildSrc/assets/themes/futureDiary/yuno/dark/yuno.dark.github.definition.json#L7)
so that the button text is readable.

I haven't figured out a good way to test theme changes, so here's what I do.

1. Create a test stylus theme.
2. run the `buildThemes` command.
3. Copy the theme's user.css you are testing.
4. `Import` the theme.
5. Overwrite the existing theme
6. Contemplate life choices
7. Repeat until satisfied.

![Theme Editing](./readmeAssets/theme_editing.gif)

Here is [an example of a editing pull request](https://github.com/doki-theme/doki-theme-github/pull/34/files)

# Creating New Themes

**IMPORTANT**! Do _not_ create brand new Doki-Themes using the GitHub Plugin. New themes should be created from the
original JetBrains plugin which uses all the colors defined. There is also Doki Theme creation assistance provided by
the IDE as well.

Please follow
the [theme creation contributions in the JetBrains Plugin repository](https://github.com/doki-theme/doki-theme-jetbrains/blob/master/CONTRIBUTING.md#creating-new-themes)
for more details on how to build new themes.

## Creating Themes Required Software

- [Editing Themes required software](#editing-themes-required-software)

## Creating Setup

- Follow the [initial setup](#initial-setup)
- You'll also probably want to have completed
  the [Doki Theme VS-Code](https://github.com/doki-theme/doki-theme-vscode/blob/master/CONTRIBUTING.md#creating-new-themes)
  process. As this plugin uses the sticker assets of the VS-Code plugin. So it helps to have those in place!

**Get the assets repository**

Clone the [doki-theme-assets](https://github.com/doki-theme/doki-theme-assets) repository in the same parent directory
as this plugin's repository.

Your folder structure should look like this:

```
your-workspace/
├─ doki-theme-github/
│  ├─ masterThemes/
├─ doki-theme-assets/
```

## Theme Creation Process

This part is mostly automated, for the most part. There is only one script you'll need to run.

### Application specific templates

Once you have a new master theme definitions merged into the default branch, it's now time to generate the application
specific templates, which allow us to control individual theme specific settings.

You'll want to edit the function used by `buildApplicationTemplate`
and `appName` [defined here](https://github.com/doki-theme/doki-master-theme/blob/596bbe7b258c65e485257a14887ee9b4e0e8b659/buildSrc/AppThemeTemplateGenerator.ts#L79)
in your `masterThemes` directory.

In the case of this plugin the `buildApplicationsTemplate` should use the `githubTemplate` and `appName` should
be `github`.

We need run the `generateTemplates` script. Which will walk the master theme definitions and create the new templates in
the `<repo-root>/buildSrc/assets/themes` directory (and update existing ones). In
the `<your-workspace>/doki-theme-github/masterThemes` run this command:

```shell
yarn generateTemplates
```

The code defined in the `buildSrc/src` directory is part of the common Doki Theme construction suite. All other plugins
work the same way, just some details change for each plugin, looking at
you [doki-theme-web](https://github.com/doki-theme/doki-theme-web). This group of code exposes a `buildThemes` node
script.

This script does all the annoying tedious stuff such as:

- Evaluating the `buildSrc/assets/templats` from the templates and putting the user.css in the right place.
  See [GitHub Specifics](#github-specifics) for more details.

Because of silly cross-origin "safety" precautions taken by GitHub (or stylus, I forget), I can't use the assets
from [https://doki.assets.unthrottled.io]. So to get around that, the GitHub user css, uses assets from the same parent
domain. So I wrote a script that forklifts the assets, plus the expected directory structure into
the `doki-theme-github/assets` directory automatically (if it doesn't exist, will not overwrite). In
the `doki-theme-github/buildSrc` directory run:

```shell
yarn copyAssets
```

> Note: you'll probably want to update the sticker's url in the tempUserCss.css.txt file to point to the branch/repo you are working on.

[Here is an example pull request that captures all the artifacts from the development process of imported themes](https://github.com/doki-theme/doki-theme-github/pull/44)
. There is going to be a heckin a lot of changes, so be prepared!
