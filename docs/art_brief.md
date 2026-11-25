# Bootleg Beasts — Art Brief for AI Image Generation

Use this with Gemini (or any image model). It keeps all symbols in one consistent style and makes
sure they drop straight into the game.

## How to get consistent results

1. Generate **Sparkjaw (H1) first**, re-rolling until you love it.
2. For every other symbol, **attach the Sparkjaw image** and start the prompt with
   *"Same art style, lighting, outline weight and camera angle as the attached image."*
3. Keep one chat for the whole set so the model keeps the style in context.

## Rules for every image

- **Square, 1024×1024**, PNG or JPG.
- The image is the **whole reel tile**, background included, so no transparency is needed.
- **One subject, centred**, filling about 85% of the frame, with a bold silhouette that still reads
  when shrunk to a 90-pixel tile.
- **No real brands, logos or franchise characters.** Don't put "Pokémon", "Pikachu", "Charizard" or
  any other real name in a prompt. Models copy those designs, and an off-model copy is still the
  original character, which is an IP problem on a public resume repo. Describe the creature instead,
  as below.
- Keep text minimal. AI text comes out garbled, which is fine for the bootleg look, but don't rely
  on it.

## Shared style (paste at the start of every prompt)

> Slot machine symbol, square tile. Gritty cyberpunk parody of cheap bootleg monster-toy merch.
> Glossy vinyl toy render, thick dark outlines, saturated neon colours, dramatic rim lighting,
> slightly grotesque and funny, adult dark-humour tone like an edgy online slot. Not cute, not for
> children.

## Premium symbols: bootleg toys in blister packs

The base for all four, after the shared style:

> A cheap knock-off toy sealed in a plastic blister pack on a printed cardboard backing card with a
> hang-tab hole at the top. The backing card fills the square tile. Halftone print dots, slightly
> off-register printing, a starburst price sticker in one corner. Only the toy's head and shoulders
> are visible inside the plastic bubble, with glare on the plastic.

| File | Creature (add after the base) | Card colour | Sticker |
|---|---|---|---|
| `H1_sparkjaw.png` | An electric street-critter toy: lumpy cyan-and-violet vinyl head, one bent lightning-bolt antenna, mismatched googly eyes (one huge, one small), wide jagged shark-tooth grin, yellow static sparks on its cheeks, a visible mould seam down the middle. Not a mouse, no pointed ears, not yellow. | violet | "NEW!!" |
| `H2_blazegob.png` | A fire-dragon goblin toy: red-to-magenta head, a flaming orange mohawk, two cream horns, crossed eyes, a crooked underbite with one fang, tiny bat wings poking out through the plastic. No flame tail, not orange. | yellow | "HOT!" |
| `H3_tidewyrm.png` | A water-serpent toy: teal-to-blue eel head with a spiky fin crest, one bulging eye and one droopy half-closed eye, drooling, gill slits, pink paint misprinted off the edges. | hot pink | "100%" |
| `H4_thornbyte.png` | A moss-gremlin plant toy: lumpy green mossy head, leaf-shaped ears, thorns, a small purple mushroom sprouting off its head, mismatched sewn-on button eyes (one with an X stitch), a stitched-up mouth. Not a bulb, no flower on its back. | orange | "REAL!" |

## Low symbols: knock-off items on a dark tile

Base, after the shared style:

> A single knock-off item centred on a plain very dark navy background (#130E25) with a soft neon
> glow behind it. No packaging.

| File | Item |
|---|---|
| `L1_heel_spray.png` | A cheap teal spray bottle of healing spray with a crooked label misspelled "HEEL", patched with yellow tape. |
| `L2_candee.png` | A crushed pink-and-white striped wrapped candy with a little tag reading "CANDEE". |
| `L3_glitch_berry.png` | A purple berry with yellow pixel-square seeds and a bite taken out, glitching with a cyan scanline. |
| `L4_champeen_medal.png` | A chipped gold star medal with "#1" on it, on a pink-and-blue ribbon, paint flaking. |
| `L5_burned_disc.png` | A cracked rainbow CD-R with "MOVES 2" scrawled in marker. |

## Special symbols (optional; the current ones work fine)

| File | Prompt (after the shared style) |
|---|---|
| `W_glitch_wild.png` | The word "WILD" as a corrupted, glitching neon sign (magenta and cyan RGB split, pixel tearing) on a dark tile. |
| `OW_override_wild.png` | A glowing cyan holographic crosshair device with arrows pointing up, down, left and right, magenta core, on a dark tile. |
| `S_capture_core.png` | A glowing gold hexagonal containment device with a bright energy core, sci-fi, on a dark tile. Not a ball, not red and white. |

## Background and logo (optional, biggest visual upgrade after the symbols)

| File | Prompt |
|---|---|
| `bg.jpg` (1920×1080) | Rainy neon cyberpunk alley at night, a sketchy back-street toy stall full of bootleg monster toys in blister packs, purple and cyan neon, shallow depth of field, dark and moody, no text. |
| `logo.png` | Game logo "BOOTLEG BEASTS", chunky glitched chrome letters with magenta and cyan RGB split, on a plain black background. |

## Hand-off

Put the files in one folder, for example `C:\Users\t_dim\Downloads\glitch-art\`, named as above,
and tell me where. I'll resize and compress them (WebP, about 256 px per tile), wire them into the
game, check readability at tile size, and note in the README that the art is AI-generated.
