package com.cobblemine.auth;

import com.google.gson.*;
import com.cobblemine.auth.mixin.*;
import com.mojang.authlib.GameProfile;
import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.*;
import net.fabricmc.fabric.api.networking.v1.*;
import net.minecraft.network.ClientConnection;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public final class AuthServer implements DedicatedServerModInitializer {
 private static final Identifier CHANNEL=Identifier.of("cobblemine","login");
 private static final String REQUIRED="§6§lCOBBLEMINE§r\n\n§cConnexion via le launcher obligatoire.\n§fPas encore de compte ? Inscris-toi sur §ecobblemine.com§f.\nDéjà inscrit ? Connecte-toi au launcher Cobblemine et clique sur Jouer.";
 private static final String INVALID="§6§lCOBBLEMINE§r\n\n§cConnexion non autorisée ou ticket expiré.\n§fReconnecte-toi au launcher Cobblemine, puis relance le jeu.\nPas encore de compte ? Inscris-toi sur §ecobblemine.com§f.";
 private static final String UNAVAILABLE="§6§lCOBBLEMINE§r\n\n§cLe service de connexion est momentanément indisponible.\n§fRéessaie dans quelques instants depuis le launcher Cobblemine.";
 private final Map<ClientConnection,Lease> leases=new HashMap<>();
 private HttpClient http;private String api,key,serverId;private int ticks;private boolean stopped;
 private java.security.KeyPair transportKey;
 private static final class Lease {
  final String token; final GameProfile profile; ServerPlayerEntity player;long expires,next;boolean pending;
  Lease(String token,GameProfile profile,long started){this.token=token;this.profile=profile;expires=started+Duration.ofSeconds(80).toNanos();next=System.nanoTime()+Duration.ofSeconds(30).toNanos();}
 }
 @Override public void onInitializeServer(){
  try{
   JsonObject config=JsonParser.parseString(Files.readString(Path.of(System.getenv().getOrDefault("COBBLEMINE_SERVER_CREDENTIALS",".private/api.json")))).getAsJsonObject();
   api=config.get("apiUrl").getAsString().replaceAll("/+$","");key=config.get("serverKey").getAsString();serverId=config.get("serverId").getAsString();
   if(!api.equals("https://api.cobblemine.com")||!key.matches("[A-Za-z0-9_-]{43}")||!serverId.matches("[a-z0-9-]{1,64}"))throw new IllegalArgumentException();
   http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).followRedirects(HttpClient.Redirect.NEVER).build();
   var generator=java.security.KeyPairGenerator.getInstance("RSA");generator.initialize(2048);transportKey=generator.generateKeyPair();
  }catch(Exception e){throw new IllegalStateException("Configuration de connexion Cobblemine absente ou invalide (.private/api.json).");}
  ServerLoginConnectionEvents.QUERY_START.register((handler,server,sender,sync)->{
   var query=PacketByteBufs.create();query.writeVarInt(1);query.writeString(serverId,64);query.writeByteArray(transportKey.getPublic().getEncoded());sender.sendPacket(CHANNEL,query);
  });
  ServerLoginNetworking.registerGlobalReceiver(CHANNEL,(server,handler,understood,buf,sync,sender)->{
   if(!understood){sync.waitFor(server.submit(()->handler.disconnect(Text.literal(REQUIRED))));return;}
   String ticket;
   try{
    int code=buf.readUnsignedByte();
    if(code!=0){sync.waitFor(server.submit(()->handler.disconnect(Text.literal(code==3?UNAVAILABLE:code==2?INVALID:REQUIRED))));return;}
    byte[] encrypted=buf.readByteArray(256);if(encrypted.length!=256||buf.isReadable())throw new IllegalArgumentException();
    var cipher=javax.crypto.Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
    cipher.init(javax.crypto.Cipher.DECRYPT_MODE,transportKey.getPrivate(),new javax.crypto.spec.OAEPParameterSpec("SHA-256","MGF1",java.security.spec.MGF1ParameterSpec.SHA256,javax.crypto.spec.PSource.PSpecified.DEFAULT));
    ticket=new String(cipher.doFinal(encrypted),StandardCharsets.US_ASCII);if(!ticket.matches("[A-Za-z0-9_-]{43}"))throw new IllegalArgumentException();
   }
   catch(Exception e){sync.waitFor(server.submit(()->handler.disconnect(Text.literal(INVALID))));return;}
   // Profile comes from the server's login state, never from the client's ticket payload.
   sync.waitFor(server.submit(()->((LoginAccess)handler).cobblemineProfile()).thenCompose(profile->{
    if(profile==null)return server.submit(()->handler.disconnect(Text.literal(INVALID)));
    JsonObject body=new JsonObject();body.addProperty("ticket",ticket);body.addProperty("username",profile.getName());
    long started=System.nanoTime();
    return post("/join-tickets/consume",body).handle((response,error)->new Object[]{response,error}).thenCompose(result->server.submit(()->{
     HttpResponse<String> response=(HttpResponse<String>)result[0];
     if(result[1]!=null||response.statusCode()>=500){handler.disconnect(Text.literal(UNAVAILABLE));return;}
     if(response.statusCode()!=200){handler.disconnect(Text.literal(response.statusCode()==409?"Ce compte est déjà connecté au serveur. Déconnecte l’autre session avant de réessayer.":INVALID));return;}
     String token=null;
     try{
      JsonObject data=JsonParser.parseString(response.body()).getAsJsonObject();token=data.get("connectionToken").getAsString();
      if(!token.matches("[A-Za-z0-9_-]{43}"))throw new IllegalArgumentException();
      JsonObject account=data.getAsJsonObject("account");
      UUID expected=UUID.nameUUIDFromBytes(("OfflinePlayer:"+profile.getName()).getBytes(StandardCharsets.UTF_8));
      if(!account.get("username").getAsString().equals(profile.getName())||!UUID.fromString(account.get("minecraftUuid").getAsString()).equals(expected)||!profile.getId().equals(expected))throw new IllegalArgumentException();
      var connection=((LoginAccess)handler).cobblemineConnection();
      if(stopped||!connection.isOpen()){release(token);return;}
      if(leases.containsKey(connection))throw new IllegalArgumentException();
      leases.put(connection,new Lease(token,profile,started));
     }catch(Exception e){if(token!=null)release(token);handler.disconnect(Text.literal(INVALID));}
    }));
   }));
  });
  ServerPlayConnectionEvents.JOIN.register((handler,sender,server)->{
   var connection=((CommonAccess)handler).cobblemineConnection();Lease lease=leases.get(connection);
   if(lease==null||!lease.profile.getId().equals(handler.player.getUuid()))handler.disconnect(Text.literal(REQUIRED));else lease.player=handler.player;
  });
  ServerTickEvents.END_SERVER_TICK.register(server->{
   if(++ticks%20!=0)return;
   long now=System.nanoTime();
   for(var entry:new ArrayList<>(leases.entrySet())){
    var connection=entry.getKey();var lease=entry.getValue();
    if(!connection.isOpen()){leases.remove(connection);release(lease.token);continue;}
    if(now>=lease.expires){disconnect(connection,lease,UNAVAILABLE);continue;}
    if(!lease.pending&&now>=lease.next){
     lease.pending=true;lease.next=now+Duration.ofSeconds(30).toNanos();JsonObject body=new JsonObject();body.addProperty("connectionToken",lease.token);
     post("/connections/heartbeat",body).whenComplete((response,error)->server.execute(()->{
      if(leases.get(connection)!=lease)return;lease.pending=false;
      if(error!=null)return;
      if(response.statusCode()==200)lease.expires=now+Duration.ofSeconds(80).toNanos();
      else if(response.statusCode()==401||response.statusCode()==403)disconnect(connection,lease,"Ta session Cobblemine a expiré ou a été révoquée. Reconnecte-toi depuis le launcher.");
     }));
    }
   }
  });
  ServerLifecycleEvents.SERVER_STOPPING.register(server->{stopped=true;for(Lease lease:leases.values())release(lease.token);leases.clear();http.shutdown();});
  ServerLifecycleEvents.SERVER_STARTED.register(server->org.slf4j.LoggerFactory.getLogger("CobblemineAuth").info("Connexion launcher obligatoire : tickets API à usage unique actifs."));
 }
 private CompletableFuture<HttpResponse<String>> post(String route,JsonObject body){
  return http.sendAsync(HttpRequest.newBuilder(URI.create(api+"/v1/server"+route)).timeout(Duration.ofSeconds(8))
   .header("Authorization","Bearer "+key).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body.toString())).build(),HttpResponse.BodyHandlers.ofString());
 }
 private void release(String token){JsonObject body=new JsonObject();body.addProperty("connectionToken",token);post("/connections/disconnect",body).exceptionally(e->null);}
 private void disconnect(ClientConnection connection,Lease lease,String reason){if(lease.player!=null)lease.player.networkHandler.disconnect(Text.literal(reason));else connection.disconnect(Text.literal(reason));leases.remove(connection);release(lease.token);}
}
