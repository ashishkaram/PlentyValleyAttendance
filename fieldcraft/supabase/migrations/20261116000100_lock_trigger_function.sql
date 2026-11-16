-- stamp_update() is a trigger function; nobody needs to call it through the API.
revoke execute on function public.stamp_update() from public, anon, authenticated;
