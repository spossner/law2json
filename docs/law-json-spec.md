# German Law XML to JSON Conversion Specification

## Overview
This specification defines the structure for converting German legal documents from XML format to JSON, preserving all metadata and hierarchical relationships while providing a clean, traversable tree structure.

## Core Node Types

### 1. Document Node
The root node of every legal document.

```json
{
  "type": "document",
  "meta": {
    "legalAbbr": "BNatSchG 2009",
    "officialAbbr": "BNatSchG",
    "date": "2009-07-29",
    "citation": {
      "publication": "BGBl I",
      "reference": "2009, 2542"
    },
    "shortTitle": "Bundesnaturschutzgesetz",
    "longTitle": "Gesetz über Naturschutz und Landschaftspflege",
    "notes": ["Zuletzt geändert durch Art. 48 G v. 23.10.2024 I Nr. 323"],
    "documentId": "BJNR254210009"
  },
  "children": [...]
}
```

### 2. Structure Node
Represents organizational hierarchy elements (Buch, Kapitel, Abschnitt, Titel, etc.)
- **Source**: XML `<norm>` elements containing `<gliederungseinheit>`
- **Identification**: Contains `gliederungskennzahl` which becomes the `id` field

```json
{
  "type": "structure",
  "meta": {
    "id": "050030",           // from gliederungskennzahl
    "label": "Abschnitt 3",   // from gliederungsbez  
    "title": "Besonderer Artenschutz" // from gliederungstitel
  },
  "children": [...]
}
```

### 3. Section Node
Represents actual legal provisions (§§, Articles, Anlagen, etc.)
- **Source**: XML `<norm>` elements with `<enbez>` but no `<gliederungseinheit>`
- **Identification**: `enbez` field becomes normalized `id` (e.g., "§ 44" → "§44")

```json
{
  "type": "section",
  "meta": {
    "id": "§44",              // normalized from enbez
    "label": "§ 44",          // original enbez
    "title": "Vorschriften für besonders geschützte Arten",
    "documentId": "BJNR254210009BJNE004502124" // optional document reference
  },
  "children": [...]
}
```

### 4. Block Node
Represents text blocks within legal provisions (Absätze)
- **Source**: XML `<P>` elements within legal text
- **Usage**: Container for mixed content - text, lists, tables, etc.
- **Structure**: No direct text/number fields - all content as children

```json
{
  "type": "block",
  "children": [
    {
      "type": "text",
      "content": "(1) Es ist verboten,"
    },
    {
      "type": "list",
      "listType": "arabic", 
      "children": [...]
    },
    {
      "type": "text",
      "content": "soweit nicht andere Vorschriften gelten."
    }
  ]
}
```

## Content Types Within Blocks

Based on lawdown.py analysis and German legal document structure, blocks can contain mixed content. With `preserveOrder: true` in the XML parser configuration, the converter automatically maintains the correct sequential order of text and lists within the same block, such as: "(1) Es ist verboten, [list] (Zugriffsverbote)."

### Text Content
Simple text nodes within blocks:

```json
{
  "type": "text",
  "content": "(1) Es ist verboten, wild lebende Tiere zu stören."
}
```

- **Plain text**: Text content within the `content` field
- **Formatted text**: Bold (`**text**`), italic (`*text*`), etc.
- **Line breaks**: `<br>` elements become newlines
- **Numbering**: Keep original numbering as-is (e.g., "(1)", "(2)", etc.)

### Lists
Hierarchical list structures with various numbering systems:

```json
{
  "type": "list",
  "listType": "arabic",     // arabic, alpha, roman, bullet
  "children": [
    {
      "type": "listItem",
      "label": "1.",          // renamed from "number"
      "children": [           // mixed content support
        {
          "type": "text",
          "content": "wild lebenden Tieren der besonders geschützten Arten nachzustellen,"
        },
        {
          "type": "list",     // nested lists supported
          "listType": "alpha",
          "children": [...]
        },
        {
          "type": "text",
          "content": "soweit dies zulässig ist."
        }
      ]
    }
  ]
}
```

**List Types:**
- `arabic` - 1., 2., 3.
- `alpha` - a), b), c)
- `Alpha` - A), B), C)
- `a-alpha` - a-, b-, c-
- `a3-alpha` - a3), b3), c3)
- `roman` - i), ii., iii.
- `Roman` - I), II), III)
- `Dash` - dashes
- `Bullet` - bullet points
- `Symbol` - various symbols
- `None` - no markers

**List Item Structure:**
- **No direct text field** - all content in `children` array
- **Mixed content supported** - text, nested lists, tables, etc.
- **`label` field** contains the numbering/bullet marker
- **Multiple LA elements** - List items can contain multiple LA (list article) elements with their own text and nested lists

### Tables
Structured tabular data from legal documents:

```json
{
  "type": "table",
  "meta": {
    "frame": "none",
    "pgwide": "1"
  },
  "children": [
    {
      "type": "tableGroup",
      "cols": 2,
      "children": [
        {
          "type": "tableHeader",
          "children": [
            {
              "type": "tableRow", 
              "children": [
                {
                  "type": "tableCell",
                  "colname": "col1",
                  "children": [
                    {
                      "type": "text",
                      "content": "§ 44"
                    }
                  ]
                },
                {
                  "type": "tableCell",
                  "colname": "col2",
                  "children": [
                    {
                      "type": "text",
                      "content": "Vorschriften für besonders geschützte Arten"
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "tableBody",
          "children": [...]
        }
      ]
    }
  ]
}
```

### Images
Image references within legal text:

```json
{
  "type": "image",
  "src": "image.png",
  "alt": "Alternative text",
  "children": []
}
```

### Footnotes
Footnote references and content:

```json
{
  "type": "footnote",
  "id": "footnote1",
  "children": []
}
```

### Definition Lists
Term-definition pairs common in legal documents:

```json
{
  "type": "definitionList",
  "children": [
    {
      "type": "definitionTerm",
      "children": [
        {
          "type": "text",
          "content": "besonders geschützte Art"
        }
      ]
    },
    {
      "type": "definitionDescription", 
      "children": [
        {
          "type": "text",
          "content": "Art, die in Anhang A oder B der Verordnung (EG) Nr. 338/97 aufgeführt ist"
        }
      ]
    }
  ]
}
```

## Field Mappings

### XML to JSON Field Renaming

**Document Metadata:**
- `ausfertigung-datum` → `date`
- `fundstelle` → `citation` (with nested `publication` and `reference`)
- `periodikum` → `publication`
- `zitstelle` → `reference`
- `kurzue` → `shortTitle`
- `langue` → `longTitle`
- `standkommentar` → `notes` (array)
- `jurabk` → `legalAbbr`
- `amtabk` → `officialAbbr`
- `doknr` → `documentId`

**Structural Elements:**
- `gliederungskennzahl` → `id`
- `gliederungsbez` → `label`
- `gliederungstitel` → `title`
- `enbez` → normalized `id` + original as `label`

### ID Normalization Rules
- Remove spaces: "§ 44" → "§44"
- Keep special characters: "§", "Art", etc.
- Examples:
  - "§ 44" → id: "§44", label: "§ 44"
  - "Anlage 1" → id: "Anlage1", label: "Anlage 1"
  - "Art 15a" → id: "Art15a", label: "Art 15a"

## Hierarchy Rules

1. **Structure Nodes**: Created from `<norm>` elements with `<gliederungseinheit>`
2. **Section Nodes**: Created from `<norm>` elements with `<enbez>` but no `<gliederungseinheit>`
3. **Nesting Depth**: Unlimited - determined by `gliederungskennzahl` length
4. **Parent-Child**: Always use `children` array, never `content`

## Example: Complete BNatSchG §44 with Complex Nested Lists

This example shows the complete structure of BNatSchG §44 including the complex nested lists in Absatz 2:

```json
{
  "type": "document",
  "meta": {
    "legalAbbr": "BNatSchG 2009",
    "officialAbbr": "BNatSchG",
    "date": "2009-07-29",
    "citation": {
      "publication": "BGBl I",
      "reference": "2009, 2542"
    },
    "shortTitle": "Bundesnaturschutzgesetz",
    "longTitle": "Gesetz über Naturschutz und Landschaftspflege",
    "notes": []
  },
  "children": [
    {
      "type": "structure",
      "meta": {
        "id": "050",
        "label": "Kapitel 5",
        "title": "Schutz der wild lebenden Tier- und Pflanzenarten, ihrer Lebensstätten und Biotope"
      },
      "children": [
        {
          "type": "structure", 
          "meta": {
            "id": "050030",
            "label": "Abschnitt 3",
            "title": "Besonderer Artenschutz"
          },
          "children": [
            {
              "type": "section",
              "meta": {
                "id": "§44",
                "label": "§ 44",
                "title": "Vorschriften für besonders geschützte und bestimmte andere Tier- und Pflanzenarten"
              },
              "children": [
                {
                  "type": "block",
                  "children": [
                    {
                      "type": "text",
                      "content": "(1) Es ist verboten,"
                    },
                    {
                      "type": "list",
                      "listType": "arabic",
                      "children": [
                        {
                          "type": "listItem",
                          "label": "1.",
                          "children": [
                            {
                              "type": "text",
                              "content": "wild lebenden Tieren der besonders geschützten Arten nachzustellen, sie zu fangen, zu verletzen oder zu töten oder ihre Entwicklungsformen aus der Natur zu entnehmen, zu beschädigen oder zu zerstören,"
                            }
                          ]
                        },
                        {
                          "type": "listItem", 
                          "label": "2.",
                          "children": [
                            {
                              "type": "text",
                              "content": "wild lebende Tiere der streng geschützten Arten und der europäischen Vogelarten während der Fortpflanzungs-, Aufzucht-, Mauser-, Überwinterungs- und Wanderungszeiten erheblich zu stören; eine erhebliche Störung liegt vor, wenn sich durch die Störung der Erhaltungszustand der lokalen Population einer Art verschlechtert,"
                            }
                          ]
                        },
                        {
                          "type": "listItem",
                          "label": "3.", 
                          "children": [
                            {
                              "type": "text",
                              "content": "Fortpflanzungs- oder Ruhestätten der wild lebenden Tiere der besonders geschützten Arten aus der Natur zu entnehmen, zu beschädigen oder zu zerstören,"
                            }
                          ]
                        },
                        {
                          "type": "listItem",
                          "label": "4.",
                          "children": [
                            {
                              "type": "text",
                              "content": "wild lebende Pflanzen der besonders geschützten Arten oder ihre Entwicklungsformen aus der Natur zu entnehmen, sie oder ihre Standorte zu beschädigen oder zu zerstören"
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "type": "text",
                      "content": "(Zugriffsverbote)."
                    }
                  ]
                },
                {
                  "type": "block",
                  "children": [
                    {
                      "type": "text",
                      "content": "(2) Es ist ferner verboten,"
                    },
                    {
                      "type": "list",
                      "listType": "arabic",
                      "children": [
                        {
                          "type": "listItem",
                          "label": "1.",
                          "children": [
                            {
                              "type": "text",
                              "content": "Tiere und Pflanzen der besonders geschützten Arten in Besitz oder Gewahrsam zu nehmen, in Besitz oder Gewahrsam zu haben oder zu be- oder verarbeiten"
                            },
                            {
                              "type": "text",
                              "content": "(Besitzverbote),"
                            }
                          ]
                        },
                        {
                          "type": "listItem",
                          "label": "2.",
                          "children": [
                            {
                              "type": "text",
                              "content": "Tiere und Pflanzen der besonders geschützten Arten im Sinne des § 7 Absatz 2 Nummer 13 Buchstabe b und c"
                            },
                            {
                              "type": "list",
                              "listType": "alpha",
                              "children": [
                                {
                                  "type": "listItem",
                                  "label": "a)",
                                  "children": [
                                    {
                                      "type": "text",
                                      "content": "zu verkaufen, zu kaufen, zum Verkauf oder Kauf anzubieten, zum Verkauf vorrätig zu halten oder zu befördern, zu tauschen oder entgeltlich zum Gebrauch oder zur Nutzung zu überlassen,"
                                    }
                                  ]
                                },
                                {
                                  "type": "listItem",
                                  "label": "b)",
                                  "children": [
                                    {
                                      "type": "text",
                                      "content": "zu kommerziellen Zwecken zu erwerben, zur Schau zu stellen oder auf andere Weise zu verwenden"
                                    }
                                  ]
                                }
                              ]
                            },
                            {
                              "type": "text",
                              "content": "(Vermarktungsverbote)."
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "type": "text",
                      "content": "Artikel 9 der Verordnung (EG) Nr. 338/97 bleibt unberührt."
                    }
                  ]
                },
                {
                  "type": "block",
                  "children": [
                    {
                      "type": "text",
                      "content": "(3) Die Besitz- und Vermarktungsverbote gelten auch für Waren im Sinne des Anhangs der Richtlinie 83/129/EWG, die entgegen den Artikeln 1 und 3 dieser Richtlinie nach dem 30. September 1983 in die Gemeinschaft gelangt sind."
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Key Features Demonstrated

This example showcases:

1. **Complete hierarchical structure** from document root through Kapitel → Abschnitt → § 44
2. **Multiple blocks** representing different Absätze (1), (2), (3)
3. **Mixed content in blocks** - text followed by lists followed by more text
4. **Nested lists** in Absatz 2: arabic numbering (1., 2.) with alpha sub-lists (a), b))
5. **Complex list item content** - multiple text nodes within single list items
6. **Preserved legal formatting** - parenthetical notes like "(Zugriffsverbote)" and "(Besitzverbote)"
7. **Reference preservation** - legal citations like "§ 7 Absatz 2 Nummer 13 Buchstabe b und c"

This structure handles the most complex legal document patterns while maintaining full semantic fidelity to the original XML.