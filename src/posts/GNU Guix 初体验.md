---
title: 'GNU Guix 初体验'
tags:
  - '计算机'
  - '编程'
  - 'linux'
date: '2026-10-05 22:01:47'
updated: '2026-10-05 22:01:47'
category: '编程'
---

对不起，Arch Linux. 你的 AUR 很棒，但是……但是……已经不能满足我了啊……

<!-- more -->

开玩笑的（bushi

## 起因

众所周知，我一直是<span class="heimu" title="你知道的太多了">起码之前是</span> Arch 神教的忠实信徒。

但几个月前的暑假中，一个平凡的早晨，当我尝试打开 Steam 美美游玩沃汉莫4W：星际马润2时，我的电脑突然死机了，一段时间后退回了 greeter界面。

那很显然，这不正常。我进行了几轮 A/B 测试，发现原因在于我的 intel + nvidia 双显卡环境下的，`prime-run`和`gamescope`的混用。一旦通过`prime-run`使用`gamescope`，intel 显卡就会因为无法读取 nvidia 显卡回传的 buf 而导致整个桌面环境的 panic：

```text
niri[1854]: intel: the execbuf ioctl keeps returning ENOMEM
niri dumped core
```

当时我[发帖](https://www.reddit.com/r/linux_gaming/comments/1vdajcy/gamescope_native_wayland_crashing_compositor_with/)问过了，也尝试搜索/咨询 LLM，却除了[他人相同的问题汇报](https://github.com/NVIDIA/open-gpu-kernel-modules/issues/1037)外一无所获——这大抵是上游 bug.

可这不合常理。我明明没有更新任何东西，没有改变任何状态，只是简单的开关机了一次，为何此前一直能正常工作的组合就难以为继？

此时，我便下定了决心，要安装一个**无状态**的系统。一来方便我复现，二来保证环境的一致性，以最大程度地维持我电脑状态的稳定。<span class="heimu" title="你知道的太多了">但这和玩游戏有什么关联？</span><span class="heimu" title="你知道的太多了">你别管</span>

## 挑选

不清楚什么是无状态的话，可以看看这篇文章[Erase your darlings](https://grahamc.com/blog/erase-your-darlings/)，很经典的一篇。

说起无状态，其往往总和“声明式”连在一起。事实上，虽然二者并非必须一起实现，但声明式的发行版确实很适合做无状态。由此，综合生态和社区人数，我的选择便很少了，无非`Nix`和`Guix`二者其一。

最终选择了`Guix`的原因有四：

- `Nix`的社区较为混乱，实现也有不止一种，往后若是分裂了（虽然看起来暂时不会）会很难做
- 很多`Nix`项目大量的在`.nix`文件中内嵌 bash 脚本，着实诡异
- `Flakes`这种已经成为事实规范的特性居然仍然是实验性的，让我很难信任`Nix`的决策团队
- `Guix`不使用`SystemD`，这一点本来我是不怎么在意的（不然我也不会用`Arch`而该去用`Artix`了），直到`SystemD` merge 了为用户加入生日字段的 PR. 即便最终回滚了，但仍让人担忧`SystemD`到底是否不受美国政府控制

不过，`Guix`的生态相比`Nix`确实弱了不少。在`Nix`下，我的需求只需组合几个现有的开源项目：`Disko`, `Impermanence`, `Lanzaboote`，即可得到我要的安全启动的无状态系统。而在`Guix`下，这一切都要我自己写。

好消息是现在是 LLM 时代，我可以指挥 Agent 帮我做这种事，我只要规划架构和提供设计目标即可，这也让我对`Guix`的选择更没有心理负担。

## 编写

感谢（以下排名不分先后）：`Kimi K3`, `DeepSeek V4 Flash`, `DeepSeek V4 Pro`, `DeepSeek V4.1 Flash`, `GPT-5.6 Sol`, `GPT-5.6 Terra`, `GPT-6 Astra`. 没有你们的帮助，我不可能完成这个配置仓库。

整个项目从暑假过半的日子开始写，一直到中秋节我才决定正式在我的主力笔记本上安装它。而后又进行了不少调整，最终化为了这番样貌：[guix-configs](https://github.com/ordchaos/guix-configs).

系统的无状态没有用 tmpfs，主要是我的笔记本 RAM 只有 16G, 经不起 tmpfs 的使用。采用了 btrfs 的快照模式，每次开机时从模板复制一个新的卷作为`/`来挂载，根据存储策略滚动删除前n代快照卷。

使用`Limine`作为 Loader 前端，以便在开机时选择正常启动还是使用上一轮磁盘快照启动到上一个正常系统。

通过 TPM 解锁 LUKS 加密的磁盘，省的每次都输入密码。

以上是得自己实现的部分，其他东西大都有现成项目可以使用/参考，这里恕不能详尽列举。

值得一提的是项目把`/home`也纳入了无状态的范畴而非囫囵的持久化它——虽然这才是主流方案。我的想法是，在`/home`拉屎的程序也不在少数，若是持久化了整个`/home`那无状态的意义也失去了一半。

自己打包没什么收益的东西或不好 elfpatch 的包全部通过 flatpak 安装，包括 qq, 微信, AAGL<span class="heimu" title="你知道的太多了">原来……你也玩原神</span>, telegram（这个是因为上游更新频繁，且每次更新都得整个重新编译）等等。

以及 VS Code 的插件也选择了声明式管理，省心也方便。

## 题外话

没了？

其实好像本来就没什么好说的（雾

顺便，大学生活很曼妙，已严肃成为清澈愚蠢的大学生（大雾

886！
