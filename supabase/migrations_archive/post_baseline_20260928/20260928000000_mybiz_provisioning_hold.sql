-- Historical reconciliation of the Owner-applied Production provisioning HOLD.
-- Production already has this ACL state. Do not replay or db push to Production.
begin;

revoke execute on function public.provision_store_from_verified_actor(
  uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text
) from public, anon, authenticated, service_role;

commit;
