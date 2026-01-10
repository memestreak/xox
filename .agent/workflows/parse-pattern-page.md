---
description: Parse a pasted pattern image
---

Please parse the image and add the patterns to the patterns.json file.

## Pattern Formats

Drum patterns should be added to the existing src/app/data/patterns.json. The Id attribute should be based on the pattern name. Pleaes be consistent with the existing formats, e.g.,

```
{
      "id": "Afro-Cub-1",
      "name": "Afro Cub 1",
      "steps": {
        "ac": "0000000000000000",
        "cy": "0000000000000000",
        "ch": "1011101010101010",
        "oh": "0000000000000000",
        "ht": "0000000000000000",
        "mt": "0000000000000000",
        "sd": "0000000000000000",
        "rs": "0001001000001000",
        "lt": "0000000000000000",
        "cp": "0000000000000000",
        "cb": "0000000000000000",
        "bd": "1000000010100010"
      }
    },
```