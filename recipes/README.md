# Recipes

This directory contains recipes for Breadboard. Each recipe is a demonstration of what how you can use Breadboard to solve a particular problem. Many of these recipes can be included directly inside boards.

## Running a Recipe

To run a recipe, run the following command from the root of the repository:

To run from the CLI:

```bash
breadboard run recipes/<recipe-name>
```

To run from the UI:

```bash
breadboard debug recipes/<recipe-name>
```

## Creating a new Recipe

To create a new recipe, create a new directory in this directory. The name of the directory should be the name of the recipe and should contain a `README.md` file that describes the recipe and a TypeScript file that contains the code for the recipe.

## List of Recipes

### Use Cases

A use case recipe is something that can be integrated into a Breadboard to solve a particular problem.

- [Fetch RSS Feed](./use-case/fetch-rss/README.md)
- [Fetch ATOm Feed](./use-case/fetch-atom/README.md)

### Concepts

A concept recipe is something that demonstrates a particular concept in Breadboard. For example, how to
