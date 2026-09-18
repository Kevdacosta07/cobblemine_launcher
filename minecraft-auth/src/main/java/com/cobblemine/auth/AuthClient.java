package com.cobblemine.auth;
import com.google.gson.*;
import com.cobblemine.auth.mixin.ClientLoginAccess;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientLoginNetworking;
import net.fabricmc.fabric.api.networking.v1.PacketByteBufs;
import net.minecraft.network.PacketByteBuf;
import net.minecraft.util.Identifier;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

public final class AuthClient implements ClientModInitializer {
 private static PacketByteBuf failure(int code){var response=PacketByteBufs.create();response.writeByte(code);return response;}
 @Override public void onInitializeClient(){
  HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build();
  ClientLoginNetworking.registerGlobalReceiver(Identifier.of("cobblemine","login"),(client,handler,buf,callbacks)->{
   try {
    if(buf.readVarInt()!=1)return CompletableFuture.completedFuture(null);
    String serverId=buf.readString(64);byte[] publicKey=buf.readByteArray(512);if(buf.isReadable())return CompletableFuture.completedFuture(null);
    String port=System.getenv("COBBLEMINE_BRIDGE_PORT"),secret=System.getenv("COBBLEMINE_BRIDGE_SECRET");
    if(port==null||!port.matches("[0-9]{1,5}")||secret==null||!secret.matches("[A-Za-z0-9_-]{43}"))return CompletableFuture.completedFuture(null);
    // Only the address actually selected in Minecraft is sent to the local launcher.
    // A different server cannot request a ticket by claiming the same server ID.
    return client.submit(()->{
     var entry=((ClientLoginAccess)handler).cobblemineServerInfo();
     return entry==null?"":entry.address;
    }).thenCompose(address->{
     JsonObject body=new JsonObject();body.addProperty("serverId",serverId);body.addProperty("address",address);
     HttpRequest request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/ticket"))
      .timeout(Duration.ofSeconds(15)).header("Authorization","Bearer "+secret).header("Content-Type","application/json")
      .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build();
     return http.sendAsync(request,HttpResponse.BodyHandlers.ofString()).thenApply(response->{
      if(response.statusCode()!=200)return failure(response.statusCode()==401?2:response.statusCode()==403?1:3);
      if(response.body().length()>2048)return failure(3);
      String ticket=JsonParser.parseString(response.body()).getAsJsonObject().get("ticket").getAsString();
      if(!ticket.matches("[A-Za-z0-9_-]{43}"))return (PacketByteBuf)null;
      try{
       var key=java.security.KeyFactory.getInstance("RSA").generatePublic(new java.security.spec.X509EncodedKeySpec(publicKey));
       var cipher=javax.crypto.Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
       cipher.init(javax.crypto.Cipher.ENCRYPT_MODE,key,new javax.crypto.spec.OAEPParameterSpec("SHA-256","MGF1",java.security.spec.MGF1ParameterSpec.SHA256,javax.crypto.spec.PSource.PSpecified.DEFAULT));
       PacketByteBuf reply=PacketByteBufs.create();reply.writeByte(0);reply.writeByteArray(cipher.doFinal(ticket.getBytes(java.nio.charset.StandardCharsets.US_ASCII)));return reply;
      }catch(Exception e){return (PacketByteBuf)null;}
     });
    }).exceptionally(error->failure(3));
   }catch(Exception e){return CompletableFuture.completedFuture(null);}
  });
 }
}
