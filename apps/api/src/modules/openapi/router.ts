import { readFileSync } from 'node:fs';
import { Router } from 'express';

const specPath = new URL('./openapi.yaml', import.meta.url);
const spec = readFileSync(specPath, 'utf-8');

export const openapiRouter = Router();

openapiRouter.get('/yaml', (_, res) => {
  res.type('text/yaml').send(spec);
});
