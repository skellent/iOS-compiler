package com.keycodelogics.panicbutton;

import android.os.Bundle;
import android.webkit.WebView;
import com.capacitorjs.plugins.splashscreen.SplashScreenPlugin;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    /**
     * The web bundle normally hides the launch splash itself. That code never runs when the
     * remote server URL cannot load and Capacitor navigates to server.errorPath instead, so hide
     * it natively once the local offline page is actually visible.
     *
     * This lives in the app-owned activity; capacitor sync does not generate or overwrite it.
     */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView webView, String url) {
                String errorUrl = getBridge().getErrorUrl();
                if (errorUrl != null && errorUrl.equals(url)) {
                    hideSplashScreen();
                }
            }
        });
        super.onCreate(savedInstanceState);
    }

    private void hideSplashScreen() {
        PluginHandle plugin = getBridge().getPlugin("SplashScreen");
        if (plugin != null && plugin.getInstance() instanceof SplashScreenPlugin splashScreen) {
            splashScreen.hide(new NativePluginCall());
        }
    }

    /** A native invocation has no JavaScript caller waiting for the plugin response. */
    private static final class NativePluginCall extends PluginCall {
        NativePluginCall() {
            super(null, "SplashScreen", CALLBACK_ID_DANGLING, "hide", new JSObject());
        }

        @Override
        public void resolve() {
            // No JavaScript callback exists for this native-only call.
        }

        @Override
        public void resolve(JSObject data) {
            // No JavaScript callback exists for this native-only call.
        }
    }
}
