import Fastify from 'fastify';

async function main() {
  const fastify = Fastify({ logger: true });

  const dashboardPath = '/_nodescope';

  fastify.get(`${dashboardPath}`, async (request, reply) => {
    return reply.type('text/html').send('Dashboard');
  });

  fastify.get(`${dashboardPath}/*`, async (request, reply) => {
    return reply.type('text/html').send(`Wildcard: ${(request.params as any)['*']}`);
  });

  fastify.all(`${dashboardPath}/api/*`, async (request, reply) => {
    return reply.send({ success: true, apiRoute: true });
  });

  await fastify.listen({ port: 3000 });
  console.log('Listening on 3000');
}
main();
