<div align="center">

# GaussianFeels — Companion Website

**M.S. Thesis companion site for _GaussianFeels: Real-time Multimodal 3D Reconstruction with Tactile-Enhanced Gaussian Splatting for In-Hand Manipulation_**

[![Live site](https://img.shields.io/badge/live-krishiattrisnu.github.io-4B8BBE)](https://krishiattrisnu.github.io)
[![Thesis PDF](https://img.shields.io/badge/PDF-available_after_defense-lightgrey)](#)
[![Poster](https://img.shields.io/badge/poster-view-lightgrey)](https://krishiattrisnu.github.io/poster.html)
[![M.S. Thesis](https://img.shields.io/badge/M.S._Thesis-Spring_2026-blue)](#)

**[Visit the site →](https://krishiattrisnu.github.io)**

</div>

---

> This repository hosts the public companion website for the GaussianFeels thesis. The production codebase is in a separate private repository and will be released after the thesis defense.

## Site contents

| Page | URL | Description |
|---|---|---|
| Main site | [`krishiattrisnu.github.io`](https://krishiattrisnu.github.io) | Method overview, benchmarks, failure cases, downloads |
| Conference poster | [`/poster.html`](https://krishiattrisnu.github.io/poster.html) | Printable A0 poster with interactive Gaussian canvas |
| Thesis PDF | — | available after defense &mdash; Spring 2026 |

## About the project

GaussianFeels is an online visuo-tactile reconstruction and tracking system built around an explicit object-centric 3D Gaussian map — updated under hand-induced occlusion, tracked when ground-truth pose supervision is removed, and exported to downstream manipulation from frame zero.

**Author:** Krishi Attri (`2024-24243`)  
**Advisor:** Prof. Yong-Lae Park, Soft Robotics & Bionics Lab  
**Institution:** Department of Mechanical Engineering, Seoul National University  
**Submission:** Spring 2026

## Files

```
index.html          Main companion site
poster.html         Conference poster page
styles.css          Shared stylesheet
hero.js             Animated Gaussian particle hero (WebGL-free, canvas 2D)
viz.js              Interactive visualizations
poster-full.png     Full-resolution poster image
poster-check.png    Poster thumbnail / preview
.nojekyll           Disables Jekyll so GitHub Pages serves files as-is
```

## Citation

```bibtex
@mastersthesis{attri2026gaussianfeels,
  title  = {GaussianFeels: Real-time Multimodal 3D Reconstruction with
            Tactile-Enhanced Gaussian Splatting for In-Hand Manipulation},
  author = {Attri, Krishi},
  school = {Seoul National University},
  year   = {2026},
  type   = {M.S. Thesis},
  address = {Department of Mechanical Engineering},
  note   = {Advisor: Prof. Yong-Lae Park}
}
```

## Links

- **Companion site:** [krishiattrisnu.github.io](https://krishiattrisnu.github.io)
- **Code repository:** available after defense at `github.com/KrishiAttriSNU/GaussianFeels`
- **Thesis PDF:** available after defense
