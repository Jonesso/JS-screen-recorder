import './App.css';
import {useEffect, useRef, useState} from "react";
import {io} from "socket.io-client";

const SERVER_URI = 'http://localhost:4000';

let mediaRecorder = null;
let dataChunks = [];

function App() {
    const username = useRef(`User_${Date.now().toString().slice(-4)}`);
    const socketRef = useRef(io(SERVER_URI));
    const videoRef = useRef();
    const linkRef = useRef();

    const [screenStream, setScreenStream] = useState();
    const [voiceStream, setVoiceStream] = useState();
    const [recording, setRecording] = useState(false);
    const [loading, setLoading] = useState(true);

    // New client connection
    useEffect(() => {
        socketRef.current.emit('user:connected', username.current);
    }, []);

    // Get video stream
    useEffect(() => {
        ;(async () => {
            // check if getDisplayMedia is supported in browser
            if (navigator.mediaDevices.getDisplayMedia) {
                try {
                    // get stream
                    const _screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: true
                    });
                    // update state
                    setScreenStream(_screenStream);
                } catch (e) {
                    console.error('*** getDisplayMedia', e);
                    setLoading(false);
                }
            } else {
                console.warn('*** getDisplayMedia not supported');
                setLoading(false);
            }
        })()
    }, [])

    // Get audio stream
    useEffect(() => {
        ;(async () => {
            //  check if getUserMedia is supported in browser
            if (navigator.mediaDevices.getUserMedia) {
                // should get video stream first
                if (screenStream) {
                    try {
                        // get stream
                        const _voiceStream = await navigator.mediaDevices.getUserMedia({
                            audio: true
                        });
                        // update state
                        setVoiceStream(_voiceStream);
                    } catch (e) {
                        console.error('*** getUserMedia', e);
                        setVoiceStream('unavailable');
                    } finally {
                        setLoading(false);
                    }
                }
            } else {
                console.warn('*** getUserMedia not supported');
                setLoading(false);
            }
        })()
    }, [screenStream]);


    function stopRecording() {
        // update state
        setRecording(false);

        // tell server that screen recording was ended
        socketRef.current.emit('screenData:end', username.current);

        const videoBlob = new Blob(dataChunks, {
            type: 'video/webm'
        });
        const videoSrc = URL.createObjectURL(videoBlob);

        videoRef.current.src = videoSrc;
        linkRef.current.href = videoSrc;
        // name of downloadable file
        linkRef.current.download = `${Date.now()}-${username.current}.webm`;

        mediaRecorder = null;
        dataChunks = [];
    }

    function startRecording() {
        if (screenStream && voiceStream && !mediaRecorder) {
            // update state
            setRecording(true);

            videoRef.current.removeAttribute('src');
            linkRef.current.removeAttribute('href');
            linkRef.current.removeAttribute('download');

            let mediaStream;
            if (voiceStream === 'unavailable') {
                mediaStream = screenStream;
            } else {
                mediaStream = new MediaStream([
                    ...screenStream.getVideoTracks(),
                    ...voiceStream.getAudioTracks()
                ]);
            }

            mediaRecorder = new MediaRecorder(mediaStream);

            mediaRecorder.ondataavailable = ({ data }) => {
                dataChunks.push(data);
                socketRef.current.emit('screenData:start', {
                    username: username.current,
                    data
                });
            };
            mediaRecorder.onstop = stopRecording;

            mediaRecorder.start(250);
        }
    }

    const onClick = () => {
        if (!recording) {
            startRecording();
        } else {
            if (mediaRecorder) {
                mediaRecorder.stop();
            }
        }
    }

    if (loading) return <Loader type='Oval' width='60' color='#0275d8' />;

    return (
        <>
            <h1>Screen Recording App</h1>
            <video controls ref={videoRef}></video>
            <a ref={linkRef}>Download</a>
            <button onClick={onClick} disabled={!voiceStream}>
                {!recording ? 'Start' : 'Stop'}
            </button>
        </>
    );
}

export default App;
