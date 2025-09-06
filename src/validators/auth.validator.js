import Joi from 'joi';

export const registerSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().max(80).optional(),
    countryCode: Joi.string().default('+1'),
    phoneNumber: Joi.string().pattern(/^[0-9]{7,15}$/).required(),
    password: Joi.string().min(6).max(128).required(),
  }).required(),
  params: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

export const loginSchema = Joi.object({
  body: Joi.object({
    phoneNumber: Joi.string().pattern(/^[0-9]{7,15}$/).required(),
    password: Joi.string().min(6).max(128).required(),
  }).required(),
  params: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});

export const refreshSchema = Joi.object({
  body: Joi.object({
    refreshToken: Joi.string().optional(),
  }).optional(),
  params: Joi.object({}).optional(),
  query: Joi.object({}).optional(),
});
