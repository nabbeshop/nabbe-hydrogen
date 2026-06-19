export async function loader() {
  return new Response('google-site-verification: google91692c29bd73452f.html', {
    headers: {'Content-Type': 'text/html'},
  });
}
