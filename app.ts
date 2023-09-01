import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
// 引入路由模块
import teamsRouter from './routes/teams';
import usersRouter from './routes/users';
import projectsRouter from './routes/projects';
import apisRouter from './routes/apis';

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());
app.use(express.static('public')); // 静态资源托管到public目录

// 注册路由
app.use('/teams', teamsRouter);
app.use('/users', usersRouter);
app.use('/projects', projectsRouter);
app.use('/apis', apisRouter);

// catch 404 and forward to error handler
app.use(function (_, __, next) {
	next(createError(404));
});

// error handler
app.use(function (err, req, res, _) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
} as express.ErrorRequestHandler);

export default app;
