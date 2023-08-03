import db from '../database/index';
import type { Request, Response } from 'express';

const indexController: {
	[key in string]: (req: Request, res: Response) => void;
} = {};

indexController.firstapi = (req, res) => {
	res.send('Hello World!');
};

export default indexController;
