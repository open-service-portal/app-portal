import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';
import { randomBytes } from 'crypto';

export const createGenerateIdAction = () => {
  return createTemplateAction({
    id: 'portal:utils:generateId',
    description: 'Generates a random ID suitable for resource naming',
    schema: {
      input: z.object({
        length: z.number().optional().default(8),
        // Could be 'hex', 'alphanumeric', 'numeric'
        type: z.enum(['hex', 'alphanumeric']).optional().default('hex'),
      }),
      output: z.object({
        id: z.string(),
      }),
    },
    async handler(ctx) {
      const { length, type } = ctx.input;
      
      let id: string;
      
      if (type === 'hex') {
        // Generate hex string (like a7b8c9d2)
        id = randomBytes(Math.ceil(length / 2))
          .toString('hex')
          .slice(0, length);
      } else {
        // Generate alphanumeric string
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const bytes = randomBytes(length);
        id = Array.from(bytes)
          .map(byte => chars[byte % chars.length])
          .join('');
      }
      
      ctx.output('id', id);
      ctx.logger.info(`Generated ID: ${id}`);
    },
  });
};