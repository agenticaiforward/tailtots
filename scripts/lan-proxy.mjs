import http from "node:http";
import net from "node:net";

const listenHost = process.env.LAN_PROXY_HOST ?? "0.0.0.0";
const listenPort = Number(process.env.LAN_PROXY_PORT ?? 3001);
const targetHost = process.env.LAN_PROXY_TARGET_HOST ?? "::1";
const targetPort = Number(process.env.LAN_PROXY_TARGET_PORT ?? 3000);

const server = http.createServer((clientReq, clientRes) => {
  const upstreamReq = http.request(
    {
      hostname: targetHost,
      port: targetPort,
      method: clientReq.method,
      path: clientReq.url,
      headers: {
        ...clientReq.headers,
        host: `localhost:${targetPort}`,
      },
    },
    (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(clientRes);
    },
  );

  upstreamReq.on("error", (error) => {
    clientRes.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    clientRes.end(`TailTots LAN proxy could not reach local app: ${error.message}`);
  });

  clientReq.pipe(upstreamReq);
});

server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(targetPort, targetHost, () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
        Object.entries({ ...req.headers, host: `localhost:${targetPort}` })
          .map(([key, value]) => `${key}: ${value}`)
          .join("\r\n") +
        "\r\n\r\n",
    );
    if (head.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", () => socket.destroy());
});

server.listen(listenPort, listenHost, () => {
  console.log(`TailTots LAN proxy: http://${listenHost}:${listenPort} -> http://[${targetHost}]:${targetPort}`);
});
