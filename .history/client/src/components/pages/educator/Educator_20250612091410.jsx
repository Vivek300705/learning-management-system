import React from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from '../../educators/Navbar'
function Educator() {
  return (
    <div className='text-deafault min-h-screen bg-white'>
    <Navbar/>
    <div className='flex '>
    <Side
        {<Outlet />}
        </div>
    </div>
  )
}

export default Educator