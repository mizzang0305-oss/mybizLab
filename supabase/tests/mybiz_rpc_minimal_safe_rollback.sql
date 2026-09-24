-- Local rehearsal only. A Production rollback needs separate Owner approval.
-- Retain receipts/data and the old RPC revoke: never restore the bypass.
begin;
update private.store_provisioning_release_control
set mode='HOLD', actor_auth_user_id=null, request_key_sha256=null,
    payload_sha256=null, expires_at=null, updated_at=now()
where singleton=true;
drop function public.provision_store_from_verified_actor(
  uuid,text,text,text,text,text,text,text,text,text,text,text,text,numeric,text
);
commit;
