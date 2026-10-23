# Monitoring and Observability

## Monitoring Stack

- **Frontend Monitoring:** Vercel Web Analytics e Speed Insights
- **Backend Monitoring:** Vercel Observability (funções) e Cloudflare Workers
  Logs e métricas (sala)
- **Error Tracking:** logs estruturados em JSON nas duas plataformas; Sentry
  fica para quando houver usuários além do Lucas e do pai
- **Alertas:** e-mail da Vercel e da Cloudflare para deploy com falha; alerta
  de log da Vercel para `fechamento` com status `falhou` (o único erro que
  pode deixar trabalho fora do git por mais tempo)
- **Performance Monitoring:** a sala mede o tempo entre receber uma escrita e
  repassar aos outros; o conector mede o tempo da mudança no disco até o
  envio. Os dois aparecem no modo de diagnóstico.

## Key Metrics

**Frontend Metrics:**
- Core Web Vitals
- JavaScript errors
- API response times
- User interactions

**Backend Metrics:**
- Request rate
- Error rate
- Response time
- Database query performance
- Específicas: latência de status e de arquivo (NFR1, NFR2), conflitos por
  jam, fechamentos com falha (NFR3)
