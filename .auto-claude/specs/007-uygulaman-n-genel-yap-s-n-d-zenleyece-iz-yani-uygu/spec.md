# Uygulamanın genel yapısını düzenleyeceğiz; yani uygulamanın amacı vs. bunlar ne olacaksa onu belirleyeceğiz

Uygulamada şunu yapması gerekiyor. Aslında, agent skill MCP gibi yapıları şu anda destekliyor. Bir agent ekleyip bu agenta skill verebiliyoruz. Buradaki amacımız, aslında agent var, skill'ler var. Bunları bir workflow içerisinde, yani bir flow içerisinde düzenleyebilmek ve sabit süreçleri buraya tanımlayabilmek.

Nasıl? Bir örnekten gidelim. Mesela, "website scraper" diye bir şeyimiz var. Biz ona input olarak bir web sitesi veriyoruz. O bize çıktı olarak, işte marktan formatında, web sitenin tamamına bakan bir yapı; yani web sitenin alt sayfalarına kadar böyle detaylı bir analiz yapan bir yapı var. Bu da bir ne diyelim, buna bir job diyebiliriz, flow diyebiliriz veya bunun adına.

Bunun iç designinin yapılması, yani "web scraper" diye bir flow'umuz olacak. Bu flow'un altında da bir agent bağlı olacak. Örnekteki olarak veriyorum, input ile başlayacak. Input, hangi web sitesinin adı verildi, gerekiyorsa description verilir; yani tanımların yapılabileceği bir yer olacak. 

Sonrasında da agenta gelecek. Agentı da nasıl çalıştırılacaksa, zaten agentla tanımlı skiller de tanımlar yapılabilir. Agent, zaten geliştirirken skillerin nasıl kullanılacağını, o input-output'u düzenleyebilecek ki agent oluştururken de AI buna göre zaten oluşturacak. 

Burası bir yapıda olacak. Sonrasında da bunu çalıştırıp output verecek. Output da dosya olarak kaydedebilir, zipli ip verebilir; süreçten sürece değişir. Database'de logon tutarsan, onları paketleyip verir gibi bir şey olacak aslında burada.

## Rationale
Şimdi diğer bütün tool'lar, mesela senin de şu an üzerinde çalıştığın Auto Cloud Tool'ı, hep böyle bir proje üzerinde geniş perspektiften bakarak işi yapıyor. 

Aslında bu geliştirdiğimiz tool'ı, bunu şeye indiriyor, yani kullanıcının süreci seviyesine. Kullanıcı bir RP süreci buraya konumlayabilir. Bir Excel koyabilir bunun içerisine, agent'a tanımlayıp süreci baştan aşağıya yönetebilir. Bir web browser'a giriş yapabilir. Veya e-posta geldiği zaman gelip tetikleyebilir gibi bir yapılı olacak. 

Yani bu Flow'un agent çalıştırması, buradan outputları, yani böyle genel kullanımı kolay, agent tanımı olan, agent'a skill'lerin bağlandığı ve bunların bir workflow üzerinden yönetilebildiği, schedule'lı, trigger'lı vs. böyle bir uygulama olmasını istiyoruz. 

Yani burada geniş kapsamda birazcık düşünüp, ilk aşamada geliştirme yaparken sadece benim kullanacağım şekilde olması gerekiyor. Yani production'daki security vs. genişleme, bunların hiçbirini göze alma. 

Direkt proje gibi yapma yani bu süreci. Sadece ben kullanacağım şekilde düşün. Çok art core production'a çıkmakla uğraşma.

## User Stories
N/A

## Acceptance Criteria
N/A
