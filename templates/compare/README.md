# Compare

2 to 4 videos side by side, each with a label, for comparing versions, themes or systems. Each panel is 540x960 (9:16): two make 1080x960, three 1620x960, four 2160x960.

```sh
npm run template compare compare.json my-compare    # -> projects/my-compare/out/cut.mp4 (no make step)
```

```json
{
  "videos": [
    {"file": "a.mp4", "label": "first cut"},
    {"file": "b.mp4", "label": "modern"},
    {"file": "c.mp4", "label": "gta6"}
  ],
  "audio": 1
}
```

| Key | Meaning |
|---|---|
| `videos` | 2 to 4 `{file, label}`, left to right |
| `audio` | Whose sound to keep, by position (default 1; 0 = silent) |
| `height` | Panel height (default 960; width follows 9:16) |
| `gap` | Pixels between panels (default 0) |
| `labels` | `false` hides the labels |

It is a **direct** template: ffmpeg renders it, because the video frame is 9:16 and this layout is landscape. It ends with the shortest video.
