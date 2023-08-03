import express from "express";
import indexController from "../controller";
const router = express.Router();

router.get("/", indexController.firstapi);

export default router;
