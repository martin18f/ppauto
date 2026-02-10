export default function handler(req, res) {
  if (req.headers.cookie?.includes('admin=1')) {
    return res.status(200).end();
  }
  return res.status(401).end();
}
