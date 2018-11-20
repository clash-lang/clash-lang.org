---
title: "New website!"
date: "2018-11-20"
description: "New version of clash-lang.org launched"
disable_comments: false
author: "martijnbastiaan"
authorbox: true # Optional, enable authorbox for specific post
toc: false
mathjax: true
---

Welcome to the new **Clash** website!
While the [old website](http://clash-lang.github.io) served us well, we wanted to have support for a [blog]({{< ref "/blog" >}}): go check out our first two posts on [matrix multiplication]({{< ref "/blog/0001-matrix-multiplication" >}}) and [systolic arrays]({{< ref "/blog/0002-systolic-arrays" >}}).

We wanted a static website for all the usual reasons (speed, security, etc), and decided to use [hugo](https://gohugo.io) because:

* It's [popular](https://www.staticgen.com/), and consequently has many resources on how to customize and setup a site.
* Is simple to install because it's a single statically compiled binary.
* It has a lot of features, including i18n support which we eventually want to use to have translated versions of our blog posts.

We're using [netlify](https://netlify.com) to host the website because:

* Automatically rebuilds and deploys the website when we push a change to the repo.
* Support for custom domains and automatic HTTPS.
* Has a great CDN ensuring speedy delivery and availability for our website across the globe.
