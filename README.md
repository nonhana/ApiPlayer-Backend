# `ApiPlayer-Backend`

## 1. 项目简介

该项目是：字节跳动第六届青训营前端大项目 2 - HTTP 接口管理平台的后端项目，选取的技术栈为：

`Node.js`+`Express`+`TypeScript`+`MySQL`。

该仓库用于统筹管理后端开发的工作进程。

## 2. 项目说明

具体可见该项目的目录结构，以下作说明：

- bin：内含`server.ts`，是整个后端项目的启动文件。
- controller：路由控制器，封装了对应路由的操作函数和逻辑结构，向外暴露，最终在 routes 目录下的具体文件中引入并使用。
- database：内含`index.ts`，配置了`MySQL`数据库的相关连接信息。
- public：公共资源目录，包括图片目录`images`，脚本目录`javascripts`，样式目录`stylesheets`
- routes：路由模块，注册路由，引入 controller 何种对应的逻辑函数进行路由注册，最后在`app.ts`上进行引入并挂载。
- views：视图目录，存放发生不合理请求的时候调用的视图。
- app.ts：express 项目的应用文件，是整个项目的配置中心，包括各种中间件的配置以及路由的注册。

## 3. 项目规范

编码规范详情可见具体的 controller 和 routes 编码实例，具体来说没那么严格。

代码风格由项目中的`.prettierrc.cjs`配置完成，问题基本来说按照格式化就没有。
