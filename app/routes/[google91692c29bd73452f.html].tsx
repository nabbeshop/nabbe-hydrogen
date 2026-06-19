export async function loader() {
  return new Response('google-site-verification: google91692c29bd73452f.html', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
