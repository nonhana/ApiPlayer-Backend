# ApiPlayer-Backend

## 1. 项目简介

该项目是：字节跳动第六届青训营前端大项目 2 - HTTP 接口管理平台的后端项目，选取的技术栈为：

`Node.js` + `Express` + `TypeScript` + `MySQL` 。

## 2. 项目说明

具体可见该项目的目录结构，以下作说明：

- bin：内含 `server.ts` ，是整个后端项目的启动文件。
- controller：路由控制器，封装了对应路由的操作函数和逻辑结构，向外暴露，最终在 routes 目录下的具体文件中引入并使用。
- database：内含 `index.ts` ，配置了 `MySQL` 数据库的相关连接信息。
- public：公共资源目录，包括图片目录 `images` ，脚本目录 `javascripts` ，样式目录 `stylesheets`
- routes：路由模块，注册路由，引入 controller 何种对应的逻辑函数进行路由注册，最后在 `app.ts` 上进行引入并挂载。
- views：视图目录，存放发生不合理请求的时候调用的视图。
- app.ts：express 项目的应用文件，是整个项目的配置中心，包括各种中间件的配置以及路由的注册。

该项目的具体搭建可以参考我之前写的一篇文章：[基于 express-generator 创建 TypeScript+Express+MySQL 项目](https://zhuanlan.zhihu.com/p/658987050)

希望这个项目能够带来一点参考与借鉴的价值~！

## 3. 一些后续计划

> 目前此项目由仓库所有者：[non_hana](https://github.com/nonhana)进行维护。

现在拿出这个项目，突然感觉到时间已经过了好久了。现在回头看当初自己写的代码，发现了很多不成熟的地方。因此，决定将目前的后端代码进行完整的重构。
现阶段考虑从 **原生 Express** 迁移到 **Nest.js** ，具体的方案仍需进一步落实。
