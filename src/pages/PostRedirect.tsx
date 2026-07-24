import { Navigate, useParams, useSearchParams } from "react-router-dom";

export default function PostRedirect() {
  const { postId } = useParams<{ postId: string }>();
  const [params] = useSearchParams();
  if (!postId) return <Navigate to="/feed" replace />;
  const next = new URLSearchParams(params);
  next.set("post", postId);
  return <Navigate to={`/feed?${next.toString()}`} replace />;
}
