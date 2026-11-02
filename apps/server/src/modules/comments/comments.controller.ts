import type { CommentBodyInput } from "@teamboard/shared";
import type { RequestHandler } from "express";
import { requireActorId } from "../../middleware/auth.js";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "./comments.service.js";

export const listCommentsController: RequestHandler = async (req, res) => {
  const { taskId } = res.locals.params as { taskId: string };
  const comments = await listComments(taskId, requireActorId(req));
  res.status(200).json({ data: { comments } });
};

export const createCommentController: RequestHandler = async (req, res) => {
  const { taskId } = res.locals.params as { taskId: string };
  const { body } = res.locals.body as CommentBodyInput;
  const comment = await createComment(taskId, requireActorId(req), body);
  res.status(201).json({ data: { comment } });
};

export const updateCommentController: RequestHandler = async (req, res) => {
  const { commentId } = res.locals.params as { commentId: string };
  const { body } = res.locals.body as CommentBodyInput;
  const comment = await updateComment(commentId, requireActorId(req), body);
  res.status(200).json({ data: { comment } });
};

export const deleteCommentController: RequestHandler = async (req, res) => {
  const { commentId } = res.locals.params as { commentId: string };
  await deleteComment(commentId, requireActorId(req));
  res.status(204).send();
};
