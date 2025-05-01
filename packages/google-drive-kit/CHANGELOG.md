# @breadboard-ai/google-drive-kit

## 0.6.0

### Minor Changes

- 3dab17c: Introduce Google Drive connector (WIP)
- f7bb416: Add support for images when saving to Google Drive.

### Patch Changes

- a84201a: Various Fixes including GAPI client instantiation, default connection
  id change, and edge comparison.
- Updated dependencies [470e548]
- Updated dependencies [34e24f0]
- Updated dependencies [99a5d95]
  - @google-labs/core-kit@0.19.0
  - @breadboard-ai/build@0.12.2
  - @google-labs/template-kit@0.3.19

## 0.5.1

### Patch Changes

- @breadboard-ai/build@0.12.1
- @google-labs/core-kit@0.18.1
- @google-labs/template-kit@0.3.18

## 0.5.0

### Minor Changes

- 63a1930: Introduce presentation hints and icon on Schema.

### Patch Changes

- 2e76cc4: Support adding images in append-to-doc
- Updated dependencies [6c223a9]
- Updated dependencies [69d315b]
- Updated dependencies [63a1930]
- Updated dependencies [40a8568]
  - @breadboard-ai/connection-client@0.2.0
  - @google-labs/core-kit@0.18.0
  - @breadboard-ai/build@0.12.0
  - @google-labs/template-kit@0.3.17

## 0.4.1

### Patch Changes

- 93a0a94: Make board server components show in component selector.
- Updated dependencies [64bbe1b]
- Updated dependencies [d73587b]
- Updated dependencies [11e4c86]
  - @breadboard-ai/build@0.11.1
  - @google-labs/core-kit@0.17.1
  - @google-labs/template-kit@0.3.16

## 0.4.0

### Minor Changes

- e37a9bf: Add image and formatting support to Context to Slides
- ca466cd: Plumb probe events (node/graph start/end) for runModule.
- 1fb9857: Add support for entity escaping.
- f472c75: Introduce "Read From Doc" component.
- 289a26f: Handle weird inputs more gracefully.
- d39d473: Add "Append to Doc" component to Google Drive Kit.
- 9d5f11b: Convert existing declarative kits to BGL.
- 1f1f7bc: Add formatting support for "Append to Doc"

### Patch Changes

- 1131130: Scope capabilities to one invocation.
- 23714f2: Escape single quotes in Google Drive API query.
- 6fe2ea2: Fix up schema in "Read From Doc".
- 31ddc9a: Various polish and fixes.
- Updated dependencies [ca466cd]
- Updated dependencies [18dace0]
- Updated dependencies [32b50af]
- Updated dependencies [8d44489]
- Updated dependencies [856e249]
- Updated dependencies [d42ab17]
  - @google-labs/core-kit@0.17.0
  - @breadboard-ai/build@0.11.0
  - @google-labs/template-kit@0.3.15

## 0.3.0

### Minor Changes

- 4dc21f4: Implement basic Google Drive Board Server
- 83b735f: Introduce "Context To Slides" component.
- 93f7874: Teach "Context to Slides" about bulleted lists.
- 3dcbf03: Teach Google Drive Board Server to save board metadata.
- bdf80d8: Teach Google Drive board server to refresh credentials.
- 4c71e39: Introduce (entirely stubbed out) Google Drive board server.
- 25b3853: Introduce "Save Context to Drive" and "Load Context from Drive"
  components.
- ef99f4e: Add an experimental "Get Breadboard Folder" component.

### Patch Changes

- 559ed8e: Remove GDrive from list if folder 404s
- Updated dependencies [9d5d6d9]
- Updated dependencies [a00058b]
- Updated dependencies [ee2844b]
- Updated dependencies [9bd4439]
- Updated dependencies [39d1913]
- Updated dependencies [bdf80d8]
- Updated dependencies [5332cbc]
  - @google-labs/core-kit@0.16.0
  - @breadboard-ai/connection-client@0.1.0
  - @breadboard-ai/build@0.10.5
  - @google-labs/template-kit@0.3.14

## 0.2.7

### Patch Changes

- Updated dependencies [b5981d0]
- Updated dependencies [413992d]
  - @breadboard-ai/build@0.10.4
  - @google-labs/core-kit@0.15.3
  - @google-labs/template-kit@0.3.13

## 0.2.6

### Patch Changes

- @breadboard-ai/build@0.10.3
- @google-labs/core-kit@0.15.2
- @google-labs/template-kit@0.3.12

## 0.2.5

### Patch Changes

- Updated dependencies [7921983]
  - @breadboard-ai/build@0.10.2
  - @google-labs/core-kit@0.15.1
  - @google-labs/template-kit@0.3.11

## 0.2.4

### Patch Changes

- 54c8197: Make build API kit function async
- Updated dependencies [49e2740]
- Updated dependencies [54c8197]
- Updated dependencies [2f1b85c]
- Updated dependencies [4dadf16]
- Updated dependencies [c145fdd]
- Updated dependencies [226be62]
- Updated dependencies [2fa05f0]
- Updated dependencies [f61ccf3]
- Updated dependencies [f71bcfb]
- Updated dependencies [3188607]
- Updated dependencies [88298d5]
- Updated dependencies [b673bfa]
- Updated dependencies [8540b93]
- Updated dependencies [feeed7a]
- Updated dependencies [8330f0c]
- Updated dependencies [1423647]
- Updated dependencies [9783ba8]
- Updated dependencies [6cdf20c]
- Updated dependencies [f63a497]
- Updated dependencies [91fe8bb]
- Updated dependencies [100fc95]
- Updated dependencies [4423c35]
- Updated dependencies [cab83ce]
- Updated dependencies [e19f046]
- Updated dependencies [5834c81]
- Updated dependencies [0ef793f]
- Updated dependencies [9c04caa]
  - @breadboard-ai/build@0.10.0
  - @google-labs/core-kit@0.15.0
  - @google-labs/template-kit@0.3.10

## 0.2.3

### Patch Changes

- a940b87: Switch to new style of declaring components in kits.
- Updated dependencies [cc5f4b6]
- Updated dependencies [a4301e6]
- Updated dependencies [a940b87]
- Updated dependencies [374ea85]
- Updated dependencies [f93ec06]
- Updated dependencies [cc5f4b6]
- Updated dependencies [398bf4f]
- Updated dependencies [7de241c]
- Updated dependencies [ee1f9ca]
  - @breadboard-ai/build@0.9.0
  - @google-labs/core-kit@0.14.0
  - @google-labs/template-kit@0.3.8

## 0.2.2

### Patch Changes

- Updated dependencies [00cc2c5]
- Updated dependencies [d88c37b]
- Updated dependencies [3a5ced1]
  - @google-labs/core-kit@0.13.0
  - @breadboard-ai/build@0.8.1
  - @google-labs/template-kit@0.3.7

## 0.2.1

### Patch Changes

- cb0f513: Convert google-drive to use new kit function.
- 38e3232: Annotate file ID/query inputs with new behaviors so that the
  dedicated input components will be used for them.
- 9a2ffab: Unpin @breadboard-ai/build dependency from being overly constrained
- 0a846ff: Switch from google-drive connection id to google-drive-limited, which
  requests access only to shared files, not all files.
- Updated dependencies [ad8aa22]
- Updated dependencies [6d2939e]
- Updated dependencies [15b6171]
- Updated dependencies [5c5b665]
- Updated dependencies [f78ec0a]
- Updated dependencies [a0852df]
- Updated dependencies [7298a47]
- Updated dependencies [ea7e2a1]
- Updated dependencies [8edcbc0]
- Updated dependencies [9a2ffab]
- Updated dependencies [b99472b]
- Updated dependencies [4bfaec5]
- Updated dependencies [2312443]
- Updated dependencies [b76f9a1]
- Updated dependencies [15ae381]
  - @breadboard-ai/build@0.8.0
  - @google-labs/core-kit@0.12.0
  - @google-labs/template-kit@0.3.6

## 0.2.0

### Minor Changes

- f2d9839: Move components into component folder. Fix some names &
  descriptions..

### Patch Changes

- 5f6432b: Internal type-safety improvement to list-files
- Updated dependencies [f4d2416]
- Updated dependencies [bc94299]
- Updated dependencies [166f290]
- Updated dependencies [da43bb5]
- Updated dependencies [5cf08f1]
- Updated dependencies [9d93cf8]
- Updated dependencies [9d93cf8]
- Updated dependencies [9d93cf8]
- Updated dependencies [26e1099]
- Updated dependencies [a9def5c]
  - @google-labs/core-kit@0.11.0
  - @breadboard-ai/build@0.7.1
  - @google-labs/template-kit@0.3.5

## 0.1.3

### Patch Changes

- 29774aa: Update dependency package versions.
- Updated dependencies [29774aa]
  - @google-labs/template-kit@0.3.4
  - @google-labs/core-kit@0.10.1

## 0.1.2

### Patch Changes

- 71d5696: Mark google-drive-kit as public.

## 0.1.1

### Patch Changes

- Updated dependencies [c27c176]
- Updated dependencies [4e66406]
- Updated dependencies [417323c]
- Updated dependencies [85bbc00]
- Updated dependencies [00825d5]
- Updated dependencies [3d7b4a7]
- Updated dependencies [4db3ab7]
- Updated dependencies [d9b76bd]
- Updated dependencies [14853d5]
- Updated dependencies [5a0afe4]
- Updated dependencies [6fdd89e]
- Updated dependencies [c82138d]
- Updated dependencies [cd73b17]
- Updated dependencies [3e10f0f]
- Updated dependencies [0e54e55]
- Updated dependencies [c53ca01]
- Updated dependencies [6ada218]
- Updated dependencies [0e76614]
- Updated dependencies [2ace620]
- Updated dependencies [c5f8e4f]
- Updated dependencies [fcef799]
- Updated dependencies [26556b6]
- Updated dependencies [5f09b1d]
- Updated dependencies [b75a43e]
- Updated dependencies [6fdd89e]
- Updated dependencies [9b1513a]
- Updated dependencies [510e198]
- Updated dependencies [9491266]
- Updated dependencies [06c3f57]
  - @google-labs/core-kit@0.10.0
  - @breadboard-ai/build@0.7.0
  - @google-labs/template-kit@0.3.3
