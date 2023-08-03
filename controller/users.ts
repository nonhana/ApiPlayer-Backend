import db from "../database/index";
import type { Request, Response } from "express";

const usersController: {
  [key in string]: (req: Request, res: Response) => void;
} = {};

usersController.firstapi = (req, res) => {
  res.send("Users Controller!");
};

export default usersController;
