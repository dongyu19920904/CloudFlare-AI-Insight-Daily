export async function handleTestTriggerScheduled(request, env, ctx, scheduledHandler) {
    try {
        const url = new URL(request.url);
        const secretKey = url.searchParams.get('key');
        const expectedKey = env.TEST_TRIGGER_SECRET || 'test-secret-key-change-me';
        if (secretKey !== expectedKey) {
            return new Response(JSON.stringify({
                error: 'Unauthorized. Please provide correct secret key.'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        const dateParam = url.searchParams.get('date');
        const forceSync = url.searchParams.get('sync') === '1';
        const specifiedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
        const fakeEvent = { scheduledTime: Date.now(), cron: '0 23 * * *' };

        const handler = scheduledHandler;
        const waitUntil = ctx && typeof ctx.waitUntil === 'function' ? ctx.waitUntil.bind(ctx) : null;
        if (waitUntil && !forceSync) {
            waitUntil(handler(fakeEvent, env, ctx, specifiedDate));
            return new Response(JSON.stringify({
                success: true,
                message: `Scheduled task started${specifiedDate ? ` for date: ${specifiedDate}` : ''}`,
                date: specifiedDate || 'current date',
                async: true,
                timestamp: new Date().toISOString()
            }), {
                status: 202,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        const fakeCtx = { waitUntil: (promise) => promise };
        const result = await handler(fakeEvent, env, fakeCtx, specifiedDate);
        return new Response(JSON.stringify({
            success: result?.success ?? true,
            message: `Scheduled task completed${specifiedDate ? ` for date: ${specifiedDate}` : ' for current date'}`,
            date: specifiedDate || 'current date',
            async: false,
            result,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
}
